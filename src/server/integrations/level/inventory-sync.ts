import "server-only";

import { getLevelServerEnvironment } from "@/config/server";
import { JobExecutionError } from "@/server/jobs/policy";
import type { ClaimedJob } from "@/server/jobs/types";
import { LevelClient, LevelClientError, type LevelDevice } from "@/server/integrations/level/client";
import {
  curateLevelDevice,
  levelDeviceChecksum,
  requireLevelInventoryAccess,
} from "@/server/integrations/level/inventory-policy";
import {
  PrismaLevelInventoryStore,
  safeDatabaseCode,
  type LevelInventoryStore,
  type SyncCounts,
} from "@/server/integrations/level/inventory-store";

export type LevelInventoryClient = {
  paginateDevices(input: {
    correlationId: string;
    pageSize?: number;
    maximumPages?: number;
    signal?: AbortSignal;
  }): AsyncGenerator<LevelDevice, void>;
};

function triggerFrom(job: ClaimedJob) {
  return job.payload.trigger === "manual" ? "manual" : "scheduled";
}

function safeProviderCode(error: unknown) {
  if (error instanceof LevelClientError) return `level_${error.code}`;
  if (error instanceof JobExecutionError) return error.code;
  return safeDatabaseCode(error);
}

export async function runLevelInventorySync(input: {
  job: ClaimedJob;
  signal?: AbortSignal;
  client?: LevelInventoryClient;
  store?: LevelInventoryStore;
  now?: () => Date;
  environment?: ReturnType<typeof getLevelServerEnvironment>;
}) {
  const environment = input.environment ?? getLevelServerEnvironment();
  const access = requireLevelInventoryAccess(environment, input.job.organizationId);
  if (!access.allowed) {
    throw new JobExecutionError(
      access.code,
      access.code === "level_tenant_mismatch"
        ? "The Level tenant mapping does not match this organisation."
        : "Level inventory access is not configured.",
    );
  }

  const now = input.now ?? (() => new Date());
  const store = input.store ?? new PrismaLevelInventoryStore();
  const client = input.client ?? new LevelClient({ apiKey: access.apiKey });
  const startedAt = now();
  const runId = await store.startRun({
    organizationId: input.job.organizationId,
    backgroundJobId: input.job.id,
    attemptNumber: input.job.attempts,
    trigger: triggerFrom(input.job),
    correlationId: input.job.correlationId,
    now: startedAt,
  });
  const counts: SyncCounts = {
    seen: 0,
    matched: 0,
    unmatched: 0,
    ambiguous: 0,
    failed: 0,
    stale: 0,
  };

  try {
    for await (const rawDevice of client.paginateDevices({
      correlationId: input.job.correlationId,
      pageSize: 100,
      signal: input.signal,
    })) {
      counts.seen += 1;
      const device = curateLevelDevice(rawDevice);
      const checksum = levelDeviceChecksum(device);
      try {
        const state = await store.synchronizeDevice({
          organizationId: input.job.organizationId,
          device,
          checksum,
          now: now(),
        });
        counts[state] += 1;
      } catch (error) {
        counts.failed += 1;
        await store.recordDeviceFailure({
          organizationId: input.job.organizationId,
          device,
          checksum,
          now: now(),
          errorCode: safeDatabaseCode(error),
        });
      }
    }
    counts.stale = await store.markStale({
      organizationId: input.job.organizationId,
      seenSince: startedAt,
      now: now(),
    });
  } catch (error) {
    const code = safeProviderCode(error);
    await store.finishRun({ runId, status: "failed", counts, errorCode: code, now: now() });
    throw new JobExecutionError(code, "Level inventory synchronization could not complete.");
  }

  if (counts.failed > 0) {
    await store.finishRun({
      runId,
      status: "partial",
      counts,
      errorCode: "level_partial_failure",
      now: now(),
    });
    throw new JobExecutionError(
      "level_partial_failure",
      "Some Level devices could not be synchronized safely.",
    );
  }

  await store.finishRun({ runId, status: "succeeded", counts, now: now() });
  return { runId, ...counts };
}
