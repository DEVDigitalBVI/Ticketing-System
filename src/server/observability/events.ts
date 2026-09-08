import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { database } from "@/server/database/client";
import { writeOperationalLog } from "@/server/observability/logger";
import { redactOperationalValue, safeErrorCode } from "@/server/observability/redaction";

export async function recordOperationalFailure(input: {
  organizationId: string;
  component: string;
  eventType: string;
  errorCode: string;
  correlationId: string;
  entityType?: string;
  entityId?: string;
  context?: Record<string, unknown>;
  occurredAt?: Date;
}) {
  const occurredAt = input.occurredAt ?? new Date();
  const errorCode = safeErrorCode(input.errorCode);
  const safeContext = redactOperationalValue(input.context ?? {}) as Prisma.InputJsonObject;
  writeOperationalLog({
    severity: "error",
    component: input.component,
    event: input.eventType,
    correlationId: input.correlationId,
    errorCode,
    context: safeContext as Record<string, unknown>,
  });
  try {
    await database.operationalEvent.create({
      data: {
        organizationId: input.organizationId,
        severity: "error",
        component: input.component,
        eventType: input.eventType,
        errorCode,
        correlationId: input.correlationId,
        entityType: input.entityType,
        entityId: input.entityId,
        safeContext,
        occurredAt,
      },
    });
    return true;
  } catch {
    writeOperationalLog({
      severity: "critical",
      component: "operational-event-store",
      event: "failure_persistence_failed",
      correlationId: input.correlationId,
      errorCode: "diagnostic_store_unavailable",
    });
    return false;
  }
}
