import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { database } from "@/server/database/client";
import {
  chooseLevelDeviceMatch,
  type CuratedLevelDevice,
  type LevelDeviceMatch,
} from "@/server/integrations/level/inventory-policy";

export type SyncCounts = {
  seen: number;
  matched: number;
  unmatched: number;
  ambiguous: number;
  failed: number;
  stale: number;
};

export type LevelInventoryStore = {
  startRun(input: {
    organizationId: string;
    backgroundJobId: string;
    attemptNumber: number;
    trigger: "manual" | "scheduled";
    correlationId: string;
    now: Date;
  }): Promise<string>;
  synchronizeDevice(input: {
    organizationId: string;
    device: CuratedLevelDevice;
    checksum: string;
    now: Date;
  }): Promise<LevelDeviceMatch["state"]>;
  recordDeviceFailure(input: {
    organizationId: string;
    device: CuratedLevelDevice;
    checksum: string;
    now: Date;
    errorCode: string;
  }): Promise<void>;
  markStale(input: { organizationId: string; seenSince: Date; now: Date }): Promise<number>;
  finishRun(input: {
    runId: string;
    status: "succeeded" | "partial" | "failed";
    counts: SyncCounts;
    errorCode?: string;
    now: Date;
  }): Promise<void>;
};

function inventoryData(
  device: CuratedLevelDevice,
  checksum: string,
  now: Date,
  state: LevelDeviceMatch["state"] | "failed",
  matchReason?: "external_link" | "serial_number",
  errorCode?: string,
) {
  return {
    hostname: device.hostname,
    serialNumber: device.serialNumber,
    manufacturer: device.manufacturer,
    model: device.model,
    platform: device.platform,
    online: device.online,
    lastSeenAt: device.lastSeenAt,
    sourceChecksum: checksum,
    syncState: state,
    matchReason: matchReason ?? null,
    lastErrorCode: errorCode ?? null,
    lastSyncedAt: now,
    staleAt: null,
  };
}

function safeDatabaseCode(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError)
    return `database_${error.code.toLowerCase()}`;
  return "device_sync_failed";
}

export class PrismaLevelInventoryStore implements LevelInventoryStore {
  async startRun(input: Parameters<LevelInventoryStore["startRun"]>[0]) {
    const run = await database.levelInventorySyncRun.create({
      data: {
        organizationId: input.organizationId,
        backgroundJobId: input.backgroundJobId,
        attemptNumber: input.attemptNumber,
        trigger: input.trigger,
        correlationId: input.correlationId,
        startedAt: input.now,
      },
      select: { id: true },
    });
    return run.id;
  }

  async synchronizeDevice(input: Parameters<LevelInventoryStore["synchronizeDevice"]>[0]) {
    return database.$transaction(async (tx) => {
      const linked = await tx.externalSystemLink.findUnique({
        where: {
          organizationId_systemKey_externalId: {
            organizationId: input.organizationId,
            systemKey: "level",
            externalId: input.device.levelDeviceId,
          },
        },
        select: { assetId: true },
      });
      const candidates =
        linked || !input.device.serialNumber
          ? []
          : await tx.asset.findMany({
              where: {
                organizationId: input.organizationId,
                serialNumber: { equals: input.device.serialNumber, mode: "insensitive" },
              },
              select: {
                id: true,
                externalLinks: {
                  where: { systemKey: "level" },
                  select: { externalId: true },
                },
              },
              take: 2,
            });
      const match = chooseLevelDeviceMatch({
        levelDeviceId: input.device.levelDeviceId,
        linkedAssetId: linked?.assetId,
        serialCandidates: candidates.map((asset) => ({
          assetId: asset.id,
          linkedLevelDeviceIds: asset.externalLinks.map((link) => link.externalId),
        })),
      });
      if (match.state === "matched" && match.createLink) {
        await tx.externalSystemLink.create({
          data: {
            organizationId: input.organizationId,
            assetId: match.assetId,
            systemKey: "level",
            externalId: input.device.levelDeviceId,
            metadata: { matchedBy: "serial_number" },
          },
        });
      }
      await tx.levelDeviceInventory.upsert({
        where: {
          organizationId_levelDeviceId: {
            organizationId: input.organizationId,
            levelDeviceId: input.device.levelDeviceId,
          },
        },
        create: {
          organizationId: input.organizationId,
          levelDeviceId: input.device.levelDeviceId,
          ...inventoryData(
            input.device,
            input.checksum,
            input.now,
            match.state,
            match.state === "matched" ? match.reason : undefined,
          ),
        },
        update: inventoryData(
          input.device,
          input.checksum,
          input.now,
          match.state,
          match.state === "matched" ? match.reason : undefined,
        ),
      });
      return match.state;
    });
  }

  async recordDeviceFailure(input: Parameters<LevelInventoryStore["recordDeviceFailure"]>[0]) {
    await database.levelDeviceInventory.upsert({
      where: {
        organizationId_levelDeviceId: {
          organizationId: input.organizationId,
          levelDeviceId: input.device.levelDeviceId,
        },
      },
      create: {
        organizationId: input.organizationId,
        levelDeviceId: input.device.levelDeviceId,
        ...inventoryData(
          input.device,
          input.checksum,
          input.now,
          "failed",
          undefined,
          input.errorCode,
        ),
      },
      update: inventoryData(
        input.device,
        input.checksum,
        input.now,
        "failed",
        undefined,
        input.errorCode,
      ),
    });
  }

  async markStale(input: Parameters<LevelInventoryStore["markStale"]>[0]) {
    const result = await database.levelDeviceInventory.updateMany({
      where: {
        organizationId: input.organizationId,
        lastSyncedAt: { lt: input.seenSince },
        syncState: { not: "stale" },
      },
      data: { syncState: "stale", matchReason: null, lastErrorCode: null, staleAt: input.now },
    });
    return result.count;
  }

  async finishRun(input: Parameters<LevelInventoryStore["finishRun"]>[0]) {
    await database.levelInventorySyncRun.update({
      where: { id: input.runId },
      data: {
        status: input.status,
        devicesSeen: input.counts.seen,
        devicesMatched: input.counts.matched,
        devicesUnmatched: input.counts.unmatched,
        devicesAmbiguous: input.counts.ambiguous,
        devicesFailed: input.counts.failed,
        devicesStale: input.counts.stale,
        lastErrorCode: input.errorCode ?? null,
        completedAt: input.now,
      },
    });
  }
}

export { safeDatabaseCode };
