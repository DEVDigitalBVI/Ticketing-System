import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import type { AccessProfile } from "@/server/auth/access";
import { accessCan } from "@/server/auth/authorization";
import { database } from "@/server/database/client";
import { AuditEventRepository } from "@/server/repositories/audit-event-repository";

export class JobOperationsError extends Error {
  constructor(readonly code: "denied" | "not_found" | "conflict") {
    super(code);
    this.name = "JobOperationsError";
  }
}

export async function readJobOperations(access: AccessProfile, now: Date) {
  if (!accessCan(access, "job.read")) throw new JobOperationsError("denied");
  const organizationId = access.organizationId;
  const [groups, pendingOutboxCount, oldestOutbox, oldestQueued, failedJobs] = await Promise.all([
    database.backgroundJob.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
    }),
    database.outboxEvent.count({ where: { organizationId, dispatchedAt: null } }),
    database.outboxEvent.findFirst({
      where: { organizationId, dispatchedAt: null },
      orderBy: { occurredAt: "asc" },
      select: { occurredAt: true },
    }),
    database.backgroundJob.findFirst({
      where: { organizationId, status: "queued" },
      orderBy: { availableAt: "asc" },
      select: { availableAt: true },
    }),
    database.backgroundJob.findMany({
      where: { organizationId, status: "dead_letter" },
      select: {
        id: true,
        category: true,
        jobType: true,
        attempts: true,
        maxAttempts: true,
        correlationId: true,
        lastErrorCode: true,
        lastErrorMessage: true,
        deadLetteredAt: true,
        replayOfJobId: true,
      },
      orderBy: { deadLetteredAt: "desc" },
      take: 100,
    }),
  ]);
  const counts = Object.fromEntries(groups.map((group) => [group.status, group._count._all]));
  return {
    pendingOutboxCount,
    oldestOutboxAt: oldestOutbox?.occurredAt ?? null,
    oldestOutboxAgeSeconds: oldestOutbox
      ? Math.max(0, Math.floor((now.getTime() - oldestOutbox.occurredAt.getTime()) / 1000))
      : 0,
    counts: {
      queued: counts.queued ?? 0,
      running: counts.running ?? 0,
      succeeded: counts.succeeded ?? 0,
      deadLetter: counts.dead_letter ?? 0,
    },
    oldestQueuedAt: oldestQueued?.availableAt ?? null,
    oldestQueuedAgeSeconds: oldestQueued
      ? Math.max(0, Math.floor((now.getTime() - oldestQueued.availableAt.getTime()) / 1000))
      : 0,
    failedJobs,
  };
}

export async function replayDeadLetterJob(
  access: AccessProfile,
  jobId: string,
  correlationId: string,
  now: Date,
) {
  if (!accessCan(access, "job.replay")) throw new JobOperationsError("denied");
  return database.$transaction(async (tx) => {
    const original = await tx.backgroundJob.findFirst({
      where: { id: jobId, organizationId: access.organizationId, status: "dead_letter" },
    });
    if (!original) throw new JobOperationsError("not_found");
    const replay = await tx.backgroundJob.create({
      data: {
        organizationId: original.organizationId,
        replayOfJobId: original.id,
        category: original.category,
        jobType: original.jobType,
        payload: original.payload as Prisma.InputJsonValue,
        correlationId,
        idempotencyKey: `${original.idempotencyKey}:replay:${randomUUID()}`,
        effectKey: original.effectKey,
        maxAttempts: original.maxAttempts,
        availableAt: now,
      },
    });
    await new AuditEventRepository(tx).record({
      organizationId: access.organizationId,
      actorUserId: access.userId,
      action: "job.replayed",
      entityType: "background_job",
      entityId: replay.id,
      result: "success",
      correlationId,
      metadata: {
        originalJobId: original.id,
        category: original.category,
        jobType: original.jobType,
      },
    });
    return replay;
  });
}
