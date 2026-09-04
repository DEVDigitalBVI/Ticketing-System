import "server-only";

import { getLevelServerEnvironment } from "@/config/server";
import type { AccessProfile } from "@/server/auth/access";
import { accessCan } from "@/server/auth/authorization";
import { database } from "@/server/database/client";
import { enqueueDomainEvent } from "@/server/jobs/outbox";
import { AuditEventRepository } from "@/server/repositories/audit-event-repository";

export class LevelInventoryJobError extends Error {
  constructor(readonly code: "denied" | "not_configured" | "tenant_mismatch") {
    super(code);
    this.name = "LevelInventoryJobError";
  }
}

export async function enqueueManualLevelInventorySync(
  access: AccessProfile,
  correlationId: string,
  now: Date,
) {
  if (!accessCan(access, "configuration.manage")) throw new LevelInventoryJobError("denied");
  const environment = getLevelServerEnvironment();
  if (!environment.LEVEL_API_KEY || !environment.LEVEL_ORGANIZATION_ID)
    throw new LevelInventoryJobError("not_configured");
  if (environment.LEVEL_ORGANIZATION_ID !== access.organizationId)
    throw new LevelInventoryJobError("tenant_mismatch");

  return database.$transaction(async (tx) => {
    const event = await enqueueDomainEvent(tx, {
      organizationId: access.organizationId,
      category: "synchronization",
      eventType: "synchronization.level_inventory",
      aggregateType: "level_integration",
      aggregateId: access.organizationId,
      payload: { trigger: "manual" },
      correlationId,
      idempotencyKey: `level-inventory:manual:${correlationId}`,
      occurredAt: now,
    });
    await new AuditEventRepository(tx).record({
      organizationId: access.organizationId,
      actorUserId: access.userId,
      action: "integration.inventory_sync_requested",
      entityType: "level_integration",
      result: "success",
      correlationId,
      metadata: { trigger: "manual" },
    });
    return event;
  });
}

export async function enqueueScheduledLevelInventorySync(now: Date) {
  const environment = getLevelServerEnvironment();
  if (
    !environment.LEVEL_INVENTORY_SYNC_ENABLED ||
    !environment.LEVEL_API_KEY ||
    !environment.LEVEL_ORGANIZATION_ID
  ) return false;
  const hour = now.toISOString().slice(0, 13);
  await database.$transaction((tx) =>
    enqueueDomainEvent(tx, {
      organizationId: environment.LEVEL_ORGANIZATION_ID!,
      category: "synchronization",
      eventType: "synchronization.level_inventory",
      aggregateType: "level_integration",
      aggregateId: environment.LEVEL_ORGANIZATION_ID!,
      payload: { trigger: "scheduled" },
      correlationId: crypto.randomUUID(),
      idempotencyKey: `level-inventory:scheduled:${hour}`,
      occurredAt: now,
    }),
  );
  return true;
}
