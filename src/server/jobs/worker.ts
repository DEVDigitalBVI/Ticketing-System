import { nextRetryAt, safeJobError } from "@/server/jobs/policy";
import { writeJobLog } from "@/server/jobs/logging";
import type { JobHandlers, JobStore } from "@/server/jobs/types";

export async function runNextJob(input: {
  store: JobStore;
  handlers: JobHandlers;
  workerId: string;
  now: Date;
  leaseMs: number;
  signal?: AbortSignal;
}) {
  const job = await input.store.claim(input.now, input.workerId, input.leaseMs);
  if (!job) return "idle" as const;
  const started = Date.now();
  const existing = await input.store.findEffect(job.organizationId, job.effectKey);
  if (existing) {
    const committed = await input.store.succeed(job, existing.result, "duplicate", input.now);
    if (!committed) return "lease_lost" as const;
    writeJobLog({
      event: "job_completed",
      jobId: job.id,
      category: job.category,
      jobType: job.jobType,
      correlationId: job.correlationId,
      attempt: job.attempts,
      status: "duplicate",
      durationMs: Date.now() - started,
    });
    return "duplicate" as const;
  }

  try {
    const handler = input.handlers[job.jobType];
    if (!handler) throw new Error("No handler registered.");
    const result = await handler(job, input.signal ?? new AbortController().signal);
    const committed = await input.store.succeed(job, result, "succeeded", input.now);
    if (!committed) return "lease_lost" as const;
    writeJobLog({
      event: "job_completed",
      jobId: job.id,
      category: job.category,
      jobType: job.jobType,
      correlationId: job.correlationId,
      attempt: job.attempts,
      status: "succeeded",
      durationMs: Date.now() - started,
    });
    return "succeeded" as const;
  } catch (error) {
    const safeError = safeJobError(error);
    const deadLetter = job.attempts >= job.maxAttempts;
    const disposition = deadLetter
      ? ({ status: "dead_letter" } as const)
      : ({ status: "queued", availableAt: nextRetryAt(input.now, job.attempts) } as const);
    const committed = await input.store.fail(job, safeError, disposition, input.now);
    if (!committed) return "lease_lost" as const;
    writeJobLog({
      event: deadLetter ? "job_dead_lettered" : "job_retry_scheduled",
      jobId: job.id,
      category: job.category,
      jobType: job.jobType,
      correlationId: job.correlationId,
      attempt: job.attempts,
      status: deadLetter ? "dead_letter" : "retry",
      errorCode: safeError.code,
      durationMs: Date.now() - started,
    });
    return disposition.status;
  }
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}

export async function runWorkerLoop(input: {
  store: JobStore;
  handlers: JobHandlers;
  workerId: string;
  signal: AbortSignal;
  now?: () => Date;
  leaseMs?: number;
  idleMs?: number;
  beforePoll?: (now: Date) => Promise<void>;
}) {
  const now = input.now ?? (() => new Date());
  while (!input.signal.aborted) {
    await input.beforePoll?.(now());
    await input.store.dispatchOutbox(now(), 100);
    if (input.signal.aborted) break;
    const result = await runNextJob({
      ...input,
      now: now(),
      leaseMs: input.leaseMs ?? 60_000,
    });
    if (result === "idle") await wait(input.idleMs ?? 1_000, input.signal);
  }
  writeJobLog({ event: "worker_stopped" });
}
