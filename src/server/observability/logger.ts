import { redactOperationalValue, safeErrorCode } from "@/server/observability/redaction";

export type OperationalLogEntry = {
  severity: "info" | "warning" | "error" | "critical";
  component: string;
  event: string;
  correlationId?: string;
  requestId?: string;
  jobId?: string;
  errorCode?: string;
  durationMs?: number;
  status?: string | number;
  context?: Record<string, unknown>;
};

export function writeOperationalLog(
  entry: OperationalLogEntry,
  sink: (line: string) => void = console.info,
  now: Date = new Date(),
) {
  const safe = redactOperationalValue({
    timestamp: now.toISOString(),
    severity: entry.severity,
    component: entry.component.slice(0, 80),
    event: entry.event.slice(0, 100),
    ...(entry.correlationId ? { correlationId: entry.correlationId } : {}),
    ...(entry.requestId ? { requestId: entry.requestId } : {}),
    ...(entry.jobId ? { jobId: entry.jobId } : {}),
    ...(entry.errorCode ? { errorCode: safeErrorCode(entry.errorCode) } : {}),
    ...(entry.durationMs !== undefined ? { durationMs: Math.max(0, entry.durationMs) } : {}),
    ...(entry.status !== undefined ? { status: entry.status } : {}),
    ...(entry.context ? { context: entry.context } : {}),
  });
  sink(JSON.stringify(safe));
}
