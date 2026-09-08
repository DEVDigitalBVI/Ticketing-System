import type { JobCategory, JobStatus } from "@/server/jobs/policy";
import { writeOperationalLog } from "@/server/observability/logger";

type SafeJobLog = {
  event: string;
  jobId?: string;
  category?: JobCategory;
  jobType?: string;
  correlationId?: string;
  attempt?: number;
  status?: JobStatus | "retry" | "duplicate" | "interrupted";
  errorCode?: string;
  durationMs?: number;
  count?: number;
};

export function writeJobLog(entry: SafeJobLog, sink: (line: string) => void = console.info) {
  const severity =
    entry.event === "job_dead_lettered" || entry.event === "worker_failed"
      ? "error"
      : entry.event === "job_retry_scheduled"
        ? "warning"
        : "info";
  const { event, correlationId, jobId, errorCode, durationMs, status, ...context } = entry;
  writeOperationalLog(
    {
      severity,
      component: "background-worker",
      event,
      correlationId,
      jobId,
      errorCode,
      durationMs,
      status,
      context,
    },
    sink,
  );
}
