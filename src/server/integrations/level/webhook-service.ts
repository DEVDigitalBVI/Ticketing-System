import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { AccessProfile } from "@/server/auth/access";
import { accessCan } from "@/server/auth/authorization";
import { database } from "@/server/database/client";
import type { ClaimedJob } from "@/server/jobs/types";
import { enqueueDomainEvent } from "@/server/jobs/outbox";
import { JobExecutionError } from "@/server/jobs/policy";
import { AuditEventRepository } from "@/server/repositories/audit-event-repository";
import type { ParsedLevelWebhook } from "@/server/integrations/level/webhook-policy";

export async function acceptLevelWebhook(input: {
  organizationId: string;
  event: ParsedLevelWebhook;
  correlationId: string;
  receivedAt: Date;
}) {
  return database.$transaction(async (tx) => {
    const inserted = await tx.levelWebhookReceipt.createMany({
      data: {
        organizationId: input.organizationId,
        externalEventId: input.event.externalEventId,
        eventType: input.event.eventType,
        resourceKey: input.event.resourceKey,
        occurredAt: input.event.occurredAt,
        receivedAt: input.receivedAt,
        processingState: input.event.supported ? "accepted" : "unsupported",
        correlationId: input.correlationId,
        diagnostics: { code: input.event.supported ? "accepted" : "unsupported_event_type" },
        lastProcessedAt: input.event.supported ? null : input.receivedAt,
      },
      skipDuplicates: true,
    });
    const receipt = await tx.levelWebhookReceipt.findUniqueOrThrow({
      where: {
        organizationId_externalEventId: {
          organizationId: input.organizationId,
          externalEventId: input.event.externalEventId,
        },
      },
      select: { id: true, processingState: true },
    });
    if (inserted.count === 1 && input.event.supported) {
      await enqueueDomainEvent(tx, {
        organizationId: input.organizationId,
        category: "webhook",
        eventType: "webhook.level.process",
        aggregateType: "level_webhook_receipt",
        aggregateId: receipt.id,
        payload: { receiptId: receipt.id },
        correlationId: input.correlationId,
        idempotencyKey: `level-webhook:${input.event.externalEventId}`,
        occurredAt: input.receivedAt,
      });
    }
    return {
      receiptId: receipt.id,
      duplicate: inserted.count === 0,
      unsupported: receipt.processingState === "unsupported",
    };
  });
}

export async function processLevelWebhookJob(job: ClaimedJob, now = new Date()) {
  const receiptId = typeof job.payload.receiptId === "string" ? job.payload.receiptId : "";
  if (!/^[0-9a-f-]{36}$/i.test(receiptId))
    throw new JobExecutionError("level_webhook_invalid_job", "Webhook job data is invalid.");

  const claimed = await database.levelWebhookReceipt.updateMany({
    where: {
      id: receiptId,
      organizationId: job.organizationId,
      processingState: { in: ["accepted", "processing"] },
    },
    data: { processingState: "processing", attemptCount: { increment: 1 } },
  });
  if (claimed.count === 0) return { receiptId, state: "already_terminal" };

  const receipt = await database.levelWebhookReceipt.findFirst({
    where: { id: receiptId, organizationId: job.organizationId },
  });
  if (!receipt)
    throw new JobExecutionError("level_webhook_missing_receipt", "Webhook receipt was not found.");

  const newer = receipt.resourceKey
    ? await database.levelWebhookReceipt.findFirst({
        where: {
          organizationId: job.organizationId,
          resourceKey: receipt.resourceKey,
          occurredAt: { gt: receipt.occurredAt },
          processingState: { not: "unsupported" },
        },
        select: { id: true },
      })
    : null;
  const state = newer ? "out_of_order" : "processed";
  await database.levelWebhookReceipt.update({
    where: { id: receipt.id },
    data: {
      processingState: state,
      diagnostics: { code: newer ? "newer_event_already_received" : "received_no_ticket_action" },
      lastProcessedAt: now,
    },
  });
  return { receiptId, state };
}

export async function replayLevelWebhookReceipt(
  access: AccessProfile,
  receiptId: string,
  correlationId: string,
  now: Date,
) {
  if (!accessCan(access, "configuration.manage")) throw new Error("Access denied.");
  return database.$transaction(async (tx) => {
    const receipt = await tx.levelWebhookReceipt.findFirst({
      where: { id: receiptId, organizationId: access.organizationId },
    });
    if (!receipt || receipt.processingState === "unsupported") throw new Error("Not found.");
    const job = await tx.backgroundJob.create({
      data: {
        organizationId: access.organizationId,
        category: "webhook",
        jobType: "webhook.level.process",
        payload: { receiptId: receipt.id },
        correlationId,
        idempotencyKey: `level-webhook:${receipt.externalEventId}:replay:${correlationId}`,
        effectKey: `level-webhook:${receipt.externalEventId}`,
        availableAt: now,
      },
    });
    await new AuditEventRepository(tx).record({
      organizationId: access.organizationId,
      actorUserId: access.userId,
      action: "integration.webhook_replayed",
      entityType: "level_webhook_receipt",
      entityId: receipt.id,
      result: "success",
      correlationId,
      metadata: { jobId: job.id, eventType: receipt.eventType },
    });
    return job;
  });
}

export function safeWebhookDatabaseError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError)
    return `database_${error.code.toLowerCase()}`;
  return "webhook_receipt_failed";
}
