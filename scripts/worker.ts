import "dotenv/config";

import { hostname } from "node:os";

import { database } from "@/server/database/client";
import { DatabaseJobStore } from "@/server/jobs/database-store";
import { jobHandlers } from "@/server/jobs/handlers";
import { writeJobLog } from "@/server/jobs/logging";
import { runWorkerLoop } from "@/server/jobs/worker";
import { enqueueScheduledLevelInventorySync } from "@/server/integrations/level/inventory-jobs";
import { recordWorkerHeartbeat } from "@/server/observability/heartbeat";
import { enqueueScheduledSlaEvaluations } from "@/server/sla/health-jobs";

const shutdown = new AbortController();
const workerId = `${hostname()}:${process.pid}`;
const workerStartedAt = new Date();

function requestShutdown(signal: string) {
  writeJobLog({ event: "worker_shutdown_requested", status: "interrupted" });
  shutdown.abort(signal);
}

process.once("SIGINT", () => requestShutdown("SIGINT"));
process.once("SIGTERM", () => requestShutdown("SIGTERM"));

try {
  await database.$connect();
  writeJobLog({ event: "worker_started" });
  let nextScheduleCheckAt = 0;
  let nextHeartbeatAt = 0;
  await runWorkerLoop({
    store: new DatabaseJobStore(),
    handlers: jobHandlers,
    workerId,
    signal: shutdown.signal,
    beforePoll: async (now) => {
      if (now.getTime() >= nextHeartbeatAt) {
        await recordWorkerHeartbeat({
          instanceId: workerId,
          startedAt: workerStartedAt,
          observedAt: now,
        });
        nextHeartbeatAt = now.getTime() + 30_000;
      }
      if (now.getTime() < nextScheduleCheckAt) return;
      nextScheduleCheckAt = now.getTime() + 60_000;
      await Promise.all([
        enqueueScheduledLevelInventorySync(now),
        enqueueScheduledSlaEvaluations(now),
      ]);
    },
  });
} catch {
  writeJobLog({ event: "worker_failed", errorCode: "worker_runtime_failed" });
  process.exitCode = 1;
} finally {
  await recordWorkerHeartbeat({
    instanceId: workerId,
    startedAt: workerStartedAt,
    observedAt: new Date(),
    status: "stopping",
  }).catch(() => undefined);
  await database.$disconnect();
}
