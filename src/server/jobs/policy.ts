import { z } from "zod";

export const jobCategories = [
  "notification",
  "sla_evaluation",
  "synchronization",
  "webhook",
] as const;
export type JobCategory = (typeof jobCategories)[number];

export const jobStatuses = ["queued", "running", "succeeded", "dead_letter"] as const;
export type JobStatus = (typeof jobStatuses)[number];

export const jobEventSchema = z.object({
  organizationId: z.string().uuid(),
  category: z.enum(jobCategories),
  eventType: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_.-]{2,99}$/),
  aggregateType: z.string().trim().min(1).max(80).optional(),
  aggregateId: z.string().trim().min(1).max(160).optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  correlationId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(1).max(200),
  occurredAt: z.date(),
});

export const defaultMaxAttempts = 5;
export const defaultLeaseMs = 60_000;
export const baseRetryDelayMs = 5_000;
export const maximumRetryDelayMs = 15 * 60_000;

export function retryDelayMs(attempt: number) {
  const exponent = Math.max(0, Math.min(attempt - 1, 20));
  return Math.min(baseRetryDelayMs * 2 ** exponent, maximumRetryDelayMs);
}

export function nextRetryAt(now: Date, attempt: number) {
  return new Date(now.getTime() + retryDelayMs(attempt));
}

export class JobExecutionError extends Error {
  constructor(
    readonly code: string,
    readonly safeMessage: string,
  ) {
    super(safeMessage);
    this.name = "JobExecutionError";
  }
}

export function safeJobError(error: unknown) {
  if (error instanceof JobExecutionError) {
    return {
      code: error.code.replace(/[^a-z0-9_.-]/gi, "_").slice(0, 80) || "handler_failed",
      message: error.safeMessage.replace(/https?:\/\/\S+/gi, "[redacted-url]").slice(0, 240),
    };
  }
  return { code: "handler_failed", message: "Job handler failed." };
}
