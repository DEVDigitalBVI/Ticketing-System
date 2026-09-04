import type { JobCategory, JobStatus } from "@/server/jobs/policy";

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
  sink(JSON.stringify({ component: "background-worker", ...entry }));
}
