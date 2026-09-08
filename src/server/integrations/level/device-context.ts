import "server-only";

import type { AccessProfile } from "@/server/auth/access";
import { accessCan } from "@/server/auth/authorization";
import { database } from "@/server/database/client";

const CONTEXT_STALE_AFTER_MS = 2 * 60 * 60 * 1_000;

export type LevelDeviceContext = {
  state: "available" | "degraded" | "unlinked";
  deviceId: string | null;
  deviceName: string | null;
  operatingSystem: string | null;
  online: boolean | null;
  lastSeenAt: Date | null;
  healthSummary: string;
  group: null;
  selectedAlerts: readonly [];
  lastSuccessfulSyncAt: Date | null;
  stale: boolean;
  deepLink: null;
  message: string | null;
};

type DeviceContextResource = {
  assetId: string;
  propertyId: string;
};

function unlinkedContext(): LevelDeviceContext {
  return {
    state: "unlinked",
    deviceId: null,
    deviceName: null,
    operatingSystem: null,
    online: null,
    lastSeenAt: null,
    healthSummary: "No Level.io device is linked to this asset.",
    group: null,
    selectedAlerts: [],
    lastSuccessfulSyncAt: null,
    stale: false,
    deepLink: null,
    message: null,
  };
}

/**
 * Device-detail URLs remain disabled until Level publishes a stable URL contract.
 * Stored provider URLs are deliberately ignored so an imported value cannot become
 * an open redirect or expose an unreviewed provider route.
 */
export function allowlistedLevelDeviceUrl(candidate: string | null | undefined): null {
  void candidate;
  return null;
}

export async function getLevelDeviceContext(
  access: AccessProfile,
  resource: DeviceContextResource,
  now = new Date(),
): Promise<LevelDeviceContext> {
  if (
    !accessCan(access, "level.context.read", {
      organizationId: access.organizationId,
      propertyId: resource.propertyId,
    })
  ) {
    throw new Error("Access denied.");
  }

  try {
    const link = await database.externalSystemLink.findUnique({
      where: { assetId_systemKey: { assetId: resource.assetId, systemKey: "level" } },
      select: { organizationId: true, externalId: true, externalUrl: true },
    });
    if (!link || link.organizationId !== access.organizationId) return unlinkedContext();

    const [device, latestRun] = await Promise.all([
      database.levelDeviceInventory.findUnique({
        where: {
          organizationId_levelDeviceId: {
            organizationId: access.organizationId,
            levelDeviceId: link.externalId,
          },
        },
        select: {
          levelDeviceId: true,
          hostname: true,
          platform: true,
          online: true,
          lastSeenAt: true,
          syncState: true,
          lastSyncedAt: true,
          lastSuccessfulSyncAt: true,
          staleAt: true,
        },
      }),
      database.levelInventorySyncRun.findFirst({
        where: { organizationId: access.organizationId },
        orderBy: { startedAt: "desc" },
        select: { status: true, startedAt: true },
      }),
    ]);
    if (!device) {
      return {
        ...unlinkedContext(),
        state: "degraded",
        deviceId: link.externalId,
        healthSummary: "The linked device is not present in the synchronized inventory.",
        message: "Device context is unavailable. The ticket and asset record remain usable.",
      };
    }

    const age = Math.max(0, now.getTime() - device.lastSyncedAt.getTime());
    const stale =
      device.staleAt !== null || device.syncState === "stale" || age > CONTEXT_STALE_AFTER_MS;
    const providerRunFailed =
      (latestRun?.status === "failed" || latestRun?.status === "partial") &&
      latestRun.startedAt > device.lastSyncedAt;
    const degraded = stale || device.syncState === "failed" || providerRunFailed;
    const healthSummary = degraded
      ? "Last known device health. Synchronization needs attention."
      : device.online === true
        ? "Online with a current synchronized snapshot."
        : device.online === false
          ? "Offline in the latest synchronized snapshot."
          : "Online state was not reported in the latest snapshot.";

    return {
      state: degraded ? "degraded" : "available",
      deviceId: device.levelDeviceId,
      deviceName: device.hostname,
      operatingSystem: device.platform,
      online: device.online,
      lastSeenAt: device.lastSeenAt,
      healthSummary,
      group: null,
      selectedAlerts: [],
      lastSuccessfulSyncAt: device.lastSuccessfulSyncAt,
      stale,
      deepLink: allowlistedLevelDeviceUrl(link.externalUrl),
      message: degraded
        ? "Level.io context is degraded. Showing the last synchronized snapshot."
        : null,
    };
  } catch {
    return {
      ...unlinkedContext(),
      state: "degraded",
      healthSummary: "Device context could not be read.",
      message:
        "Level.io context is temporarily unavailable. The ticket and asset record remain usable.",
    };
  }
}
