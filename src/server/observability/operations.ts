import "server-only";

import type { AccessProfile } from "@/server/auth/access";
import { accessCan } from "@/server/auth/authorization";
import { database } from "@/server/database/client";
import {
  evaluateOperationalHealth,
  overallOperationalState,
} from "@/server/observability/health-policy";

function ageSeconds(now: Date, value: Date | null | undefined) {
  return value ? Math.max(0, Math.floor((now.getTime() - value.getTime()) / 1000)) : null;
}

export class OperationsAccessError extends Error {
  constructor() {
    super("denied");
    this.name = "OperationsAccessError";
  }
}

export async function readOperationalOverview(access: AccessProfile, now: Date) {
  if (!accessCan(access, "job.read")) throw new OperationsAccessError();
  const organizationId = access.organizationId;
  const recent = new Date(now.getTime() - 15 * 60_000);
  const [
    worker,
    oldestQueued,
    deadLetterCount,
    stuckWebhook,
    lastLevelSync,
    deliveryFailureCount,
    notificationFailureCount,
    lastSlaEvaluation,
    failures,
    reconciliationCount,
  ] = await Promise.all([
    database.workerHeartbeat.findFirst({
      where: { component: "background-worker", status: { not: "stopping" } },
      orderBy: { lastSeenAt: "desc" },
    }),
    database.backgroundJob.findFirst({
      where: { organizationId, status: "queued", availableAt: { lte: now } },
      orderBy: { availableAt: "asc" },
      select: { availableAt: true },
    }),
    database.backgroundJob.count({ where: { organizationId, status: "dead_letter" } }),
    database.levelWebhookReceipt.findFirst({
      where: { organizationId, processingState: { in: ["accepted", "processing"] } },
      orderBy: { receivedAt: "asc" },
      select: { receivedAt: true },
    }),
    database.levelInventorySyncRun.findFirst({
      where: { organizationId, status: "succeeded" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    }),
    database.operationalEvent.count({
      where: {
        organizationId,
        occurredAt: { gte: recent },
        eventType: "email_delivery_failed",
        resolvedAt: null,
      },
    }),
    database.backgroundJob.count({
      where: {
        organizationId,
        category: "notification",
        updatedAt: { gte: recent },
        OR: [{ status: "dead_letter" }, { lastErrorCode: { not: null } }],
      },
    }),
    database.backgroundJob.findFirst({
      where: { organizationId, jobType: "sla.evaluate", status: "succeeded" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    }),
    database.operationalEvent.findMany({
      where: { organizationId, resolvedAt: null },
      orderBy: [{ severity: "desc" }, { occurredAt: "desc" }],
      take: 50,
      select: {
        id: true,
        severity: true,
        component: true,
        eventType: true,
        errorCode: true,
        correlationId: true,
        occurredAt: true,
        safeContext: true,
      },
    }),
    database.levelDeviceInventory.count({
      where: { organizationId, syncState: { in: ["unmatched", "ambiguous", "failed", "stale"] } },
    }),
  ]);

  const levelConfigured = process.env.LEVEL_INVENTORY_SYNC_ENABLED === "true";
  const signals = evaluateOperationalHealth({
    databaseAvailable: true,
    workerHeartbeatAgeSeconds: ageSeconds(now, worker?.lastSeenAt),
    oldestQueuedAgeSeconds: ageSeconds(now, oldestQueued?.availableAt),
    deadLetterCount,
    stuckWebhookAgeSeconds: ageSeconds(now, stuckWebhook?.receivedAt),
    levelConfigured,
    levelSyncAgeSeconds: ageSeconds(now, lastLevelSync?.completedAt),
    deliveryFailureCount,
    notificationFailureCount,
    slaEvaluationAgeSeconds: ageSeconds(now, lastSlaEvaluation?.completedAt),
  });
  return {
    overall: overallOperationalState(signals),
    observedAt: now,
    signals,
    failures,
    reconciliationCount,
  };
}

export async function readReadiness(now = new Date()) {
  try {
    await database.$queryRaw`SELECT 1`;
    const worker = await database.workerHeartbeat.findFirst({
      where: { component: "background-worker", status: { not: "stopping" } },
      orderBy: { lastSeenAt: "desc" },
      select: { lastSeenAt: true },
    });
    const signals = evaluateOperationalHealth({
      databaseAvailable: true,
      workerHeartbeatAgeSeconds: ageSeconds(now, worker?.lastSeenAt),
      oldestQueuedAgeSeconds: null,
      deadLetterCount: 0,
      stuckWebhookAgeSeconds: null,
      levelConfigured: false,
      levelSyncAgeSeconds: null,
      deliveryFailureCount: 0,
      notificationFailureCount: 0,
      slaEvaluationAgeSeconds: null,
    })
      .filter((signal) => signal.key === "database" || signal.key === "worker")
      .map((signal) =>
        signal.key === "worker" && signal.state === "unknown"
          ? { ...signal, state: "critical" as const, summary: "No worker heartbeat recorded" }
          : signal,
      );
    const state = overallOperationalState(signals);
    return { ready: state !== "critical", state, checks: signals };
  } catch {
    const signals = evaluateOperationalHealth({
      databaseAvailable: false,
      workerHeartbeatAgeSeconds: null,
      oldestQueuedAgeSeconds: null,
      deadLetterCount: 0,
      stuckWebhookAgeSeconds: null,
      levelConfigured: false,
      levelSyncAgeSeconds: null,
      deliveryFailureCount: 0,
      notificationFailureCount: 0,
      slaEvaluationAgeSeconds: null,
    });
    return { ready: false, state: "critical" as const, checks: signals };
  }
}
