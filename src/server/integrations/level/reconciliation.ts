import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { AccessProfile } from "@/server/auth/access";
import { accessCan } from "@/server/auth/authorization";
import { database } from "@/server/database/client";
import { AuditEventRepository } from "@/server/repositories/audit-event-repository";

export class LevelReconciliationError extends Error {
  constructor(readonly code: "denied" | "not_found" | "conflict") {
    super(code);
    this.name = "LevelReconciliationError";
  }
}

export async function readLevelReconciliation(access: AccessProfile) {
  if (!accessCan(access, "configuration.manage")) throw new LevelReconciliationError("denied");
  const organizationId = access.organizationId;
  const [devices, assets, runs] = await Promise.all([
    database.levelDeviceInventory.findMany({
      where: {
        organizationId,
        syncState: { in: ["unmatched", "ambiguous", "stale", "failed"] },
      },
      orderBy: [{ syncState: "asc" }, { updatedAt: "desc" }],
      take: 250,
    }),
    database.asset.findMany({
      where: { organizationId },
      select: { id: true, assetTag: true, name: true, serialNumber: true },
      orderBy: { assetTag: "asc" },
      take: 1_000,
    }),
    database.levelInventorySyncRun.findMany({
      where: { organizationId },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
  ]);
  return { devices, assets, runs };
}

export async function reconcileLevelDevice(
  access: AccessProfile,
  input: { deviceId: string; assetId: string },
  correlationId: string,
) {
  if (!accessCan(access, "configuration.manage")) throw new LevelReconciliationError("denied");
  return database.$transaction(async (tx) => {
    const [device, asset] = await Promise.all([
      tx.levelDeviceInventory.findFirst({
        where: { id: input.deviceId, organizationId: access.organizationId },
      }),
      tx.asset.findFirst({
        where: { id: input.assetId, organizationId: access.organizationId },
        select: { id: true, propertyId: true },
      }),
    ]);
    if (!device || !asset) throw new LevelReconciliationError("not_found");

    const [deviceLink, assetLink] = await Promise.all([
      tx.externalSystemLink.findUnique({
        where: {
          organizationId_systemKey_externalId: {
            organizationId: access.organizationId,
            systemKey: "level",
            externalId: device.levelDeviceId,
          },
        },
      }),
      tx.externalSystemLink.findUnique({
        where: { assetId_systemKey: { assetId: asset.id, systemKey: "level" } },
      }),
    ]);
    if (
      (deviceLink && deviceLink.assetId !== asset.id) ||
      (assetLink && assetLink.externalId !== device.levelDeviceId)
    ) throw new LevelReconciliationError("conflict");

    if (!deviceLink) {
      await tx.externalSystemLink.create({
        data: {
          organizationId: access.organizationId,
          assetId: asset.id,
          systemKey: "level",
          externalId: device.levelDeviceId,
          metadata: { matchedBy: "manual" },
        },
      });
    }
    await tx.levelDeviceInventory.update({
      where: { id: device.id },
      data: {
        syncState: "matched",
        matchReason: "manual",
        lastErrorCode: null,
        staleAt: null,
      },
    });
    await new AuditEventRepository(tx).record({
      organizationId: access.organizationId,
      propertyId: asset.propertyId,
      actorUserId: access.userId,
      action: "integration.device_reconciled",
      entityType: "level_device",
      entityId: device.id,
      result: "success",
      correlationId,
      metadata: { assetId: asset.id },
    });
  }).catch((error) => {
    if (error instanceof LevelReconciliationError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      throw new LevelReconciliationError("conflict");
    throw error;
  });
}
