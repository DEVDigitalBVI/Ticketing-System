import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { database } from "@/server/database/client";
import { defaultMaxAttempts, type JobCategory } from "@/server/jobs/policy";
import type { ClaimedJob, JobStore } from "@/server/jobs/types";

type OutboxRow = {
  id: string;
  organizationId: string;
  category: JobCategory;
  eventType: string;
  payload: Prisma.JsonValue;
  correlationId: string;
  idempotencyKey: string;
};

type ClaimedRow = Omit<ClaimedJob, "payload"> & { payload: Prisma.JsonValue };

class LeaseLostError extends Error {}

function inputJson(value: Prisma.JsonValue) {
  return value as Prisma.InputJsonValue;
}

export class DatabaseJobStore implements JobStore {
  async dispatchOutbox(now: Date, limit: number) {
    return database.$transaction(async (tx) => {
      const events = await tx.$queryRaw<OutboxRow[]>(Prisma.sql`
        select
          id,
          organization_id as "organizationId",
          category,
          event_type as "eventType",
          payload,
          correlation_id as "correlationId",
          idempotency_key as "idempotencyKey"
        from service_desk.outbox_events
        where dispatched_at is null
        order by occurred_at, id
        for update skip locked
        limit ${Math.min(Math.max(limit, 1), 500)}
      `);
      for (const event of events) {
        await tx.backgroundJob.upsert({
          where: {
            organizationId_idempotencyKey: {
              organizationId: event.organizationId,
              idempotencyKey: event.idempotencyKey,
            },
          },
          create: {
            organizationId: event.organizationId,
            outboxEventId: event.id,
            category: event.category,
            jobType: event.eventType,
            payload: inputJson(event.payload),
            correlationId: event.correlationId,
            idempotencyKey: event.idempotencyKey,
            effectKey: event.idempotencyKey,
            maxAttempts: defaultMaxAttempts,
            availableAt: now,
          },
          update: {},
        });
        await tx.outboxEvent.update({
          where: { id: event.id },
          data: { dispatchedAt: now },
        });
      }
      return events.length;
    });
  }

  async claim(now: Date, workerId: string, leaseMs: number) {
    const lockToken = randomUUID();
    const lockedUntil = new Date(now.getTime() + leaseMs);
    return database.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<ClaimedRow[]>(Prisma.sql`
        with candidate as (
          select id, (status = 'running') as recovered
          from service_desk.background_jobs
          where
            (status = 'queued' and available_at <= ${now})
            or (status = 'running' and locked_until <= ${now})
          order by available_at, created_at
          for update skip locked
          limit 1
        )
        update service_desk.background_jobs as jobs
        set
          status = 'running',
          attempts = jobs.attempts + 1,
          locked_at = ${now},
          locked_until = ${lockedUntil},
          lock_token = ${lockToken}::uuid,
          worker_id = ${workerId},
          last_error_code = null,
          last_error_message = null
        from candidate
        where jobs.id = candidate.id
        returning
          jobs.id,
          jobs.organization_id as "organizationId",
          jobs.category,
          jobs.job_type as "jobType",
          jobs.payload,
          jobs.correlation_id as "correlationId",
          jobs.idempotency_key as "idempotencyKey",
          jobs.effect_key as "effectKey",
          jobs.attempts,
          jobs.max_attempts as "maxAttempts",
          jobs.lock_token as "lockToken",
          candidate.recovered
      `);
      const row = rows[0];
      if (!row) return null;
      if (row.recovered) {
        await tx.backgroundJobAttempt.updateMany({
          where: { jobId: row.id, completedAt: null, outcome: "running" },
          data: { completedAt: now, outcome: "interrupted" },
        });
      }
      await tx.backgroundJobAttempt.create({
        data: {
          organizationId: row.organizationId,
          jobId: row.id,
          attemptNumber: row.attempts,
          workerId,
          startedAt: now,
        },
      });
      return { ...row, payload: row.payload as Record<string, unknown> };
    });
  }

  async findEffect(organizationId: string, effectKey: string) {
    const effect = await database.backgroundJobEffect.findUnique({
      where: { organizationId_effectKey: { organizationId, effectKey } },
      select: { result: true },
    });
    return effect ? { result: effect.result as Record<string, unknown> } : null;
  }

  async succeed(
    job: ClaimedJob,
    result: Record<string, unknown>,
    outcome: "succeeded" | "duplicate",
    now: Date,
  ) {
    try {
      await database.$transaction(async (tx) => {
        const updated = await tx.backgroundJob.updateMany({
          where: { id: job.id, status: "running", lockToken: job.lockToken },
          data: {
            status: "succeeded",
            completedAt: now,
            lockedAt: null,
            lockedUntil: null,
            lockToken: null,
            workerId: null,
          },
        });
        if (updated.count !== 1) throw new LeaseLostError();
        await tx.backgroundJobEffect.createMany({
          data: {
            organizationId: job.organizationId,
            jobId: job.id,
            effectKey: job.effectKey,
            result: result as Prisma.InputJsonValue,
            completedAt: now,
          },
          skipDuplicates: true,
        });
        await tx.backgroundJobAttempt.updateMany({
          where: { jobId: job.id, attemptNumber: job.attempts, completedAt: null },
          data: { completedAt: now, outcome },
        });
      });
      return true;
    } catch (error) {
      if (error instanceof LeaseLostError) return false;
      throw error;
    }
  }

  async fail(
    job: ClaimedJob,
    error: { code: string; message: string },
    disposition: { status: "queued"; availableAt: Date } | { status: "dead_letter" },
    now: Date,
  ) {
    try {
      await database.$transaction(async (tx) => {
        const deadLetter = disposition.status === "dead_letter";
        const updated = await tx.backgroundJob.updateMany({
          where: { id: job.id, status: "running", lockToken: job.lockToken },
          data: {
            status: disposition.status,
            availableAt: disposition.status === "queued" ? disposition.availableAt : now,
            deadLetteredAt: deadLetter ? now : null,
            lockedAt: null,
            lockedUntil: null,
            lockToken: null,
            workerId: null,
            lastErrorCode: error.code,
            lastErrorMessage: error.message,
          },
        });
        if (updated.count !== 1) throw new LeaseLostError();
        await tx.backgroundJobAttempt.updateMany({
          where: { jobId: job.id, attemptNumber: job.attempts, completedAt: null },
          data: {
            completedAt: now,
            outcome: deadLetter ? "dead_letter" : "retry",
            errorCode: error.code,
            errorMessage: error.message,
          },
        });
      });
      return true;
    } catch (failure) {
      if (failure instanceof LeaseLostError) return false;
      throw failure;
    }
  }
}
