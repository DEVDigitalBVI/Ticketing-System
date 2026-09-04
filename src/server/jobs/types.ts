import type { JobCategory } from "@/server/jobs/policy";

export type ClaimedJob = {
  id: string;
  organizationId: string;
  category: JobCategory;
  jobType: string;
  payload: Record<string, unknown>;
  correlationId: string;
  idempotencyKey: string;
  effectKey: string;
  attempts: number;
  maxAttempts: number;
  lockToken: string;
  recovered: boolean;
};

export type JobEffect = { result: Record<string, unknown> };

export type JobStore = {
  dispatchOutbox(now: Date, limit: number): Promise<number>;
  claim(now: Date, workerId: string, leaseMs: number): Promise<ClaimedJob | null>;
  findEffect(organizationId: string, effectKey: string): Promise<JobEffect | null>;
  succeed(
    job: ClaimedJob,
    result: Record<string, unknown>,
    outcome: "succeeded" | "duplicate",
    now: Date,
  ): Promise<boolean>;
  fail(
    job: ClaimedJob,
    error: { code: string; message: string },
    disposition: { status: "queued"; availableAt: Date } | { status: "dead_letter" },
    now: Date,
  ): Promise<boolean>;
};

export type JobHandler = (job: ClaimedJob, signal: AbortSignal) => Promise<Record<string, unknown>>;
export type JobHandlers = Record<string, JobHandler>;
