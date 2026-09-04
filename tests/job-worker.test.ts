import { describe, expect, it, vi } from "vitest";

import { JobExecutionError } from "@/server/jobs/policy";
import type { ClaimedJob, JobStore } from "@/server/jobs/types";
import { runNextJob } from "@/server/jobs/worker";

const clock = new Date("2026-09-04T12:00:00.000Z");

function job(overrides: Partial<ClaimedJob> = {}): ClaimedJob {
  return {
    id: "a8de35c7-c9e2-4848-8646-a06bab160b2f",
    organizationId: "18b8d97e-9622-4ca7-b344-6230ad863e84",
    category: "notification",
    jobType: "synthetic.test",
    payload: { privateValue: "never logged" },
    correlationId: "36a569a3-e62b-4293-b1a8-35059fd7856c",
    idempotencyKey: "synthetic:1",
    effectKey: "synthetic-effect:1",
    attempts: 1,
    maxAttempts: 3,
    lockToken: "d3be57e5-2517-401f-8187-31cf231b7a1e",
    recovered: false,
    ...overrides,
  };
}

function store(claimed: ClaimedJob, effect: { result: Record<string, unknown> } | null = null) {
  return {
    dispatchOutbox: vi.fn(async () => 0),
    claim: vi.fn(async () => claimed),
    findEffect: vi.fn(async () => effect),
    succeed: vi.fn(async () => true),
    fail: vi.fn(async () => true),
  } satisfies JobStore;
}

describe("synthetic background jobs", () => {
  it("retries a safe failure at the exact next boundary", async () => {
    const repository = store(job());
    const result = await runNextJob({
      store: repository,
      handlers: {
        "synthetic.test": async () => {
          throw new JobExecutionError("synthetic_failure", "Synthetic job failed safely.");
        },
      },
      workerId: "test-worker",
      now: clock,
      leaseMs: 60_000,
    });

    expect(result).toBe("queued");
    expect(repository.fail).toHaveBeenCalledWith(
      expect.anything(),
      { code: "synthetic_failure", message: "Synthetic job failed safely." },
      { status: "queued", availableAt: new Date("2026-09-04T12:00:05.000Z") },
      clock,
    );
  });

  it("moves the final failed attempt to dead letter", async () => {
    const repository = store(job({ attempts: 3, maxAttempts: 3 }));
    const result = await runNextJob({
      store: repository,
      handlers: { "synthetic.test": async () => Promise.reject(new Error("secret")) },
      workerId: "test-worker",
      now: clock,
      leaseMs: 60_000,
    });
    expect(result).toBe("dead_letter");
    expect(repository.fail).toHaveBeenCalledWith(
      expect.anything(),
      { code: "handler_failed", message: "Job handler failed." },
      { status: "dead_letter" },
      clock,
    );
  });

  it("does not execute a duplicate delivery when the durable effect exists", async () => {
    const handler = vi.fn(async () => ({ shouldNot: "run" }));
    const repository = store(job({ recovered: true }), { result: { original: true } });
    const result = await runNextJob({
      store: repository,
      handlers: { "synthetic.test": handler },
      workerId: "recovery-worker",
      now: clock,
      leaseMs: 60_000,
    });
    expect(result).toBe("duplicate");
    expect(handler).not.toHaveBeenCalled();
    expect(repository.succeed).toHaveBeenCalledWith(
      expect.anything(),
      { original: true },
      "duplicate",
      clock,
    );
  });

  it("treats a lost lease as interruption without committing an effect", async () => {
    const repository = store(job({ recovered: true }));
    repository.succeed.mockResolvedValue(false);
    const result = await runNextJob({
      store: repository,
      handlers: { "synthetic.test": async () => ({ completed: true }) },
      workerId: "recovery-worker",
      now: clock,
      leaseMs: 60_000,
    });
    expect(result).toBe("lease_lost");
  });
});
