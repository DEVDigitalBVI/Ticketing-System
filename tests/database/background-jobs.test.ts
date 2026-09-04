import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AccessProfile } from "@/server/auth/access";
import { createDatabaseClient } from "@/server/database/factory";
import { DatabaseJobStore } from "@/server/jobs/database-store";
import { replayDeadLetterJob } from "@/server/jobs/operations";
import { commitWithOutbox } from "@/server/jobs/outbox";
import { JobExecutionError } from "@/server/jobs/policy";
import { runNextJob } from "@/server/jobs/worker";

const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL is required for database tests.");
const client = createDatabaseClient(connectionString);
const store = new DatabaseJobStore();

const ids = {
  organization: "18b8d97e-9622-4ca7-b344-6230ad863e84",
  operator: "42cd5c6c-7854-44f5-9954-67a5f47f82c9",
};
const operator: AccessProfile = {
  userId: ids.operator,
  authUserId: crypto.randomUUID(),
  email: "job-operator@example.invalid",
  displayName: "Job Operator",
  organizationId: ids.organization,
  organizationName: "Peter Island Resort and Spa",
  properties: [],
  departmentIds: [],
  roles: ["system_administrator"],
  assuranceLevel: "aal2",
  mustChangePassword: false,
};

beforeAll(async () => {
  await client.$connect();
  await client.user.upsert({
    where: { id: ids.operator },
    create: {
      id: ids.operator,
      organizationId: ids.organization,
      email: operator.email,
      displayName: operator.displayName,
      mustChangePassword: false,
    },
    update: {},
  });
});

afterAll(async () => client.$disconnect());

describe("Step 17 transactional outbox and durable jobs", () => {
  it("commits the domain mutation and event atomically, then retries exactly once", async () => {
    const userId = crypto.randomUUID();
    const eventKey = `synthetic:user:${userId}`;
    await commitWithOutbox(
      (tx) =>
        tx.user.create({
          data: {
            id: userId,
            organizationId: ids.organization,
            email: `${userId}@example.invalid`,
            displayName: "Synthetic Job User",
            mustChangePassword: false,
          },
        }),
      () => ({
        organizationId: ids.organization,
        category: "notification",
        eventType: "synthetic.retry",
        aggregateType: "user",
        aggregateId: userId,
        payload: { userId },
        correlationId: crypto.randomUUID(),
        idempotencyKey: eventKey,
        occurredAt: new Date("2026-09-04T12:00:00.000Z"),
      }),
    );
    expect(await client.user.findUnique({ where: { id: userId } })).not.toBeNull();
    expect(
      await client.outboxEvent.findFirst({ where: { idempotencyKey: eventKey } }),
    ).not.toBeNull();

    const firstClock = new Date("2026-09-04T12:00:00.000Z");
    expect(await store.dispatchOutbox(firstClock, 10)).toBe(1);
    const firstResult = await runNextJob({
      store,
      handlers: {
        "synthetic.retry": async () => {
          throw new JobExecutionError("synthetic_retry", "Synthetic retry requested.");
        },
      },
      workerId: "database-worker-1",
      now: firstClock,
      leaseMs: 60_000,
    });
    expect(firstResult).toBe("queued");
    expect(await store.claim(new Date("2026-09-04T12:00:04.999Z"), "too-early", 60_000)).toBeNull();

    const retryClock = new Date("2026-09-04T12:00:05.000Z");
    const retryResult = await runNextJob({
      store,
      handlers: { "synthetic.retry": async () => ({ applied: true }) },
      workerId: "database-worker-2",
      now: retryClock,
      leaseMs: 60_000,
    });
    expect(retryResult).toBe("succeeded");
    const completed = await client.backgroundJob.findFirstOrThrow({
      where: { idempotencyKey: eventKey },
      include: { attemptsHistory: true, effects: true },
    });
    expect(completed.status).toBe("succeeded");
    expect(completed.attemptsHistory.map((attempt) => attempt.outcome)).toEqual([
      "retry",
      "succeeded",
    ]);
    expect(completed.effects).toHaveLength(1);
  });

  it("rolls back the domain mutation when its outbox event is invalid", async () => {
    const userId = crypto.randomUUID();
    await expect(
      commitWithOutbox(
        (tx) =>
          tx.user.create({
            data: {
              id: userId,
              organizationId: ids.organization,
              email: `${userId}@example.invalid`,
              displayName: "Must Roll Back",
              mustChangePassword: false,
            },
          }),
        () => ({
          organizationId: ids.organization,
          category: "notification",
          eventType: "synthetic.rollback",
          payload: {},
          correlationId: "not-a-uuid",
          idempotencyKey: `rollback:${userId}`,
          occurredAt: new Date("2026-09-04T12:00:00.000Z"),
        }),
      ),
    ).rejects.toBeTruthy();
    expect(await client.user.findUnique({ where: { id: userId } })).toBeNull();
  });

  it("recovers an expired lease and records the interrupted attempt", async () => {
    const job = await client.backgroundJob.create({
      data: {
        organizationId: ids.organization,
        category: "sla_evaluation",
        jobType: "synthetic.recovery",
        payload: {},
        correlationId: crypto.randomUUID(),
        idempotencyKey: `recovery:${crypto.randomUUID()}`,
        effectKey: `recovery-effect:${crypto.randomUUID()}`,
        status: "running",
        attempts: 1,
        availableAt: new Date("2026-09-04T11:00:00.000Z"),
        lockedAt: new Date("2026-09-04T11:00:00.000Z"),
        lockedUntil: new Date("2026-09-04T11:01:00.000Z"),
        lockToken: crypto.randomUUID(),
        workerId: "crashed-worker",
        attemptsHistory: {
          create: {
            organizationId: ids.organization,
            attemptNumber: 1,
            workerId: "crashed-worker",
            startedAt: new Date("2026-09-04T11:00:00.000Z"),
          },
        },
      },
    });
    const recovered = await store.claim(
      new Date("2026-09-04T12:00:00.000Z"),
      "recovery-worker",
      60_000,
    );
    expect(recovered).toMatchObject({ id: job.id, attempts: 2, recovered: true });
    const attempts = await client.backgroundJobAttempt.findMany({
      where: { jobId: job.id },
      orderBy: { attemptNumber: "asc" },
    });
    expect(attempts.map((attempt) => attempt.outcome)).toEqual(["interrupted", "running"]);
    await store.succeed(
      recovered!,
      { recovered: true },
      "succeeded",
      new Date("2026-09-04T12:00:01.000Z"),
    );
  });

  it("dead-letters, exposes, replays, and deduplicates a synthetic effect", async () => {
    const effectKey = `dead-effect:${crypto.randomUUID()}`;
    const original = await client.backgroundJob.create({
      data: {
        organizationId: ids.organization,
        category: "webhook",
        jobType: "synthetic.dead",
        payload: {},
        correlationId: crypto.randomUUID(),
        idempotencyKey: `dead:${crypto.randomUUID()}`,
        effectKey,
        maxAttempts: 1,
        availableAt: new Date("2026-09-04T13:00:00.000Z"),
      },
    });
    expect(
      await runNextJob({
        store,
        handlers: { "synthetic.dead": async () => Promise.reject(new Error("private detail")) },
        workerId: "dead-worker",
        now: new Date("2026-09-04T13:00:00.000Z"),
        leaseMs: 60_000,
      }),
    ).toBe("dead_letter");
    const dead = await client.backgroundJob.findUniqueOrThrow({ where: { id: original.id } });
    expect(dead.lastErrorMessage).toBe("Job handler failed.");

    const replay = await replayDeadLetterJob(
      operator,
      original.id,
      crypto.randomUUID(),
      new Date("2026-09-04T13:01:00.000Z"),
    );
    expect(replay.replayOfJobId).toBe(original.id);

    await client.backgroundJobEffect.create({
      data: {
        organizationId: ids.organization,
        jobId: original.id,
        effectKey,
        result: { alreadyApplied: true },
        completedAt: new Date("2026-09-04T13:00:30.000Z"),
      },
    });
    const handler = async () => {
      throw new Error("must not run");
    };
    expect(
      await runNextJob({
        store,
        handlers: { "synthetic.dead": handler },
        workerId: "replay-worker",
        now: new Date("2026-09-04T13:01:00.000Z"),
        leaseMs: 60_000,
      }),
    ).toBe("duplicate");
    expect(
      (await client.backgroundJob.findUniqueOrThrow({ where: { id: replay.id } })).status,
    ).toBe("succeeded");
  });
});
