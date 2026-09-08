export type OperationalState = "healthy" | "degraded" | "critical" | "unknown";

export const operationalThresholds = {
  workerHeartbeatWarningSeconds: 90,
  workerHeartbeatCriticalSeconds: 180,
  oldestQueuedWarningSeconds: 120,
  oldestQueuedCriticalSeconds: 300,
  webhookWarningSeconds: 120,
  webhookCriticalSeconds: 300,
  levelSyncWarningMinutes: 90,
  levelSyncCriticalMinutes: 120,
  slaEvaluationWarningMinutes: 10,
  slaEvaluationCriticalMinutes: 20,
  deliveryFailureCriticalCount: 3,
} as const;

export type HealthSignal = {
  key: string;
  label: string;
  state: OperationalState;
  summary: string;
  value: number | null;
  unit?: "seconds" | "minutes" | "count";
};

function ageSignal(input: {
  key: string;
  label: string;
  ageSeconds: number | null;
  warningSeconds: number;
  criticalSeconds: number;
  healthySummary: string;
}) {
  if (input.ageSeconds === null)
    return {
      key: input.key,
      label: input.label,
      state: "unknown",
      summary: "No observation recorded",
      value: null,
    } satisfies HealthSignal;
  const state =
    input.ageSeconds >= input.criticalSeconds
      ? "critical"
      : input.ageSeconds >= input.warningSeconds
        ? "degraded"
        : "healthy";
  return {
    key: input.key,
    label: input.label,
    state,
    summary:
      state === "healthy"
        ? input.healthySummary
        : `Last healthy observation was ${Math.floor(input.ageSeconds / 60)} minutes ago`,
    value: input.ageSeconds,
    unit: "seconds",
  } satisfies HealthSignal;
}

export function evaluateOperationalHealth(input: {
  databaseAvailable: boolean;
  workerHeartbeatAgeSeconds: number | null;
  oldestQueuedAgeSeconds: number | null;
  deadLetterCount: number;
  stuckWebhookAgeSeconds: number | null;
  levelConfigured: boolean;
  levelSyncAgeSeconds: number | null;
  deliveryFailureCount: number;
  notificationFailureCount: number;
  slaEvaluationAgeSeconds: number | null;
}): HealthSignal[] {
  if (!input.databaseAvailable)
    return [
      {
        key: "database",
        label: "Service database",
        state: "critical",
        summary: "Connection unavailable",
        value: null,
      },
    ];

  const worker = ageSignal({
    key: "worker",
    label: "Background worker",
    ageSeconds: input.workerHeartbeatAgeSeconds,
    warningSeconds: operationalThresholds.workerHeartbeatWarningSeconds,
    criticalSeconds: operationalThresholds.workerHeartbeatCriticalSeconds,
    healthySummary: "Heartbeat is current",
  });
  const queueState =
    input.deadLetterCount > 0 ||
    (input.oldestQueuedAgeSeconds ?? 0) >= operationalThresholds.oldestQueuedCriticalSeconds
      ? "critical"
      : (input.oldestQueuedAgeSeconds ?? 0) >= operationalThresholds.oldestQueuedWarningSeconds
        ? "degraded"
        : "healthy";
  const webhookState =
    input.stuckWebhookAgeSeconds === null
      ? "healthy"
      : input.stuckWebhookAgeSeconds >= operationalThresholds.webhookCriticalSeconds
        ? "critical"
        : input.stuckWebhookAgeSeconds >= operationalThresholds.webhookWarningSeconds
          ? "degraded"
          : "healthy";
  const level = input.levelConfigured
    ? ageSignal({
        key: "level-sync",
        label: "Level.io inventory",
        ageSeconds: input.levelSyncAgeSeconds,
        warningSeconds: operationalThresholds.levelSyncWarningMinutes * 60,
        criticalSeconds: operationalThresholds.levelSyncCriticalMinutes * 60,
        healthySummary: "Inventory snapshot is current",
      })
    : ({
        key: "level-sync",
        label: "Level.io inventory",
        state: "unknown",
        summary: "Integration is not configured",
        value: null,
      } satisfies HealthSignal);
  const deliveryCount = input.deliveryFailureCount + input.notificationFailureCount;
  const deliveryState =
    deliveryCount >= operationalThresholds.deliveryFailureCriticalCount
      ? "critical"
      : deliveryCount > 0
        ? "degraded"
        : "healthy";

  return [
    {
      key: "database",
      label: "Service database",
      state: "healthy",
      summary: "Connection available",
      value: 1,
      unit: "count",
    },
    worker,
    {
      key: "queue",
      label: "Worker backlog",
      state: queueState,
      summary: input.deadLetterCount
        ? `${input.deadLetterCount} dead-letter job${input.deadLetterCount === 1 ? "" : "s"}`
        : input.oldestQueuedAgeSeconds
          ? `Oldest queued job is ${input.oldestQueuedAgeSeconds} seconds old`
          : "No delayed work",
      value: input.oldestQueuedAgeSeconds ?? 0,
      unit: "seconds",
    },
    {
      key: "webhooks",
      label: "Level.io webhooks",
      state: webhookState,
      summary:
        input.stuckWebhookAgeSeconds === null
          ? "No stuck receipts"
          : `Oldest unfinished receipt is ${input.stuckWebhookAgeSeconds} seconds old`,
      value: input.stuckWebhookAgeSeconds,
      unit: "seconds",
    },
    level,
    {
      key: "delivery",
      label: "Email and notifications",
      state: deliveryState,
      summary: deliveryCount
        ? `${deliveryCount} failure${deliveryCount === 1 ? "" : "s"} in the last 15 minutes`
        : "No recent delivery failures",
      value: deliveryCount,
      unit: "count",
    },
    ageSignal({
      key: "sla",
      label: "SLA evaluation",
      ageSeconds: input.slaEvaluationAgeSeconds,
      warningSeconds: operationalThresholds.slaEvaluationWarningMinutes * 60,
      criticalSeconds: operationalThresholds.slaEvaluationCriticalMinutes * 60,
      healthySummary: "Evaluation is current",
    }),
  ];
}

export function overallOperationalState(signals: HealthSignal[]) {
  if (signals.some((signal) => signal.state === "critical")) return "critical" as const;
  if (signals.some((signal) => signal.state === "degraded")) return "degraded" as const;
  if (signals.some((signal) => signal.state === "unknown")) return "unknown" as const;
  return "healthy" as const;
}
