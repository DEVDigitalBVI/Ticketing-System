import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  findLink: vi.fn(),
  findDevice: vi.fn(),
  findRun: vi.fn(),
}));

vi.mock("@/server/database/client", () => ({
  database: {
    externalSystemLink: { findUnique: mocks.findLink },
    levelDeviceInventory: { findUnique: mocks.findDevice },
    levelInventorySyncRun: { findFirst: mocks.findRun },
  },
}));

import type { AccessProfile } from "@/server/auth/access";
import {
  allowlistedLevelDeviceUrl,
  getLevelDeviceContext,
} from "@/server/integrations/level/device-context";

const ids = {
  organization: "11111111-1111-4111-8111-111111111111",
  property: "22222222-2222-4222-8222-222222222222",
  asset: "33333333-3333-4333-8333-333333333333",
};

function access(role: AccessProfile["roles"][number]): AccessProfile {
  return {
    userId: "44444444-4444-4444-8444-444444444444",
    authUserId: "55555555-5555-4555-8555-555555555555",
    email: "user@example.invalid",
    displayName: "Service desk user",
    organizationId: ids.organization,
    organizationName: "Peter Island Resort and Spa",
    properties: [{ id: ids.property, name: "Peter Island" }],
    departmentIds: [],
    roles: [role],
    roleAssignments: [{ propertyId: ids.property, role }],
    assuranceLevel: "aal1",
    mustChangePassword: false,
  };
}

const freshDevice = {
  levelDeviceId: "level-current",
  hostname: "FRONT-DESK-01",
  platform: "Windows 11 Pro",
  online: true,
  lastSeenAt: new Date("2026-09-08T12:55:00.000Z"),
  syncState: "matched",
  lastSyncedAt: new Date("2026-09-08T13:00:00.000Z"),
  lastSuccessfulSyncAt: new Date("2026-09-08T13:00:00.000Z"),
  staleAt: null,
};

describe("Level.io technician device context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findLink.mockResolvedValue({
      organizationId: ids.organization,
      externalId: "level-current",
      externalUrl: null,
    });
    mocks.findDevice.mockResolvedValue(freshDevice);
    mocks.findRun.mockResolvedValue({
      status: "succeeded",
      startedAt: new Date("2026-09-08T13:00:00.000Z"),
    });
  });

  it("returns only the curated snapshot to an authorized technician", async () => {
    const context = await getLevelDeviceContext(
      access("technician"),
      { assetId: ids.asset, propertyId: ids.property },
      new Date("2026-09-08T13:30:00.000Z"),
    );
    expect(context).toEqual(
      expect.objectContaining({
        state: "available",
        deviceId: "level-current",
        deviceName: "FRONT-DESK-01",
        operatingSystem: "Windows 11 Pro",
        online: true,
        stale: false,
        deepLink: null,
      }),
    );
    expect(context).not.toHaveProperty("externalUrl");
    expect(context).not.toHaveProperty("lastErrorCode");
  });

  it("denies a staff requester before any Level snapshot query", async () => {
    await expect(
      getLevelDeviceContext(access("requester"), {
        assetId: ids.asset,
        propertyId: ids.property,
      }),
    ).rejects.toThrow("Access denied.");
    expect(mocks.findLink).not.toHaveBeenCalled();
  });

  it("labels an old snapshot as stale while preserving its approved fields", async () => {
    const context = await getLevelDeviceContext(
      access("technician"),
      { assetId: ids.asset, propertyId: ids.property },
      new Date("2026-09-08T16:00:01.000Z"),
    );
    expect(context.state).toBe("degraded");
    expect(context.stale).toBe(true);
    expect(context.deviceName).toBe("FRONT-DESK-01");
  });

  it("returns an explicit unlinked state without querying device inventory", async () => {
    mocks.findLink.mockResolvedValue(null);
    const context = await getLevelDeviceContext(access("technician"), {
      assetId: ids.asset,
      propertyId: ids.property,
    });
    expect(context.state).toBe("unlinked");
    expect(context.deviceId).toBeNull();
    expect(mocks.findDevice).not.toHaveBeenCalled();
  });

  it("shows the last snapshot as degraded after a provider sync failure", async () => {
    mocks.findRun.mockResolvedValue({
      status: "failed",
      startedAt: new Date("2026-09-08T13:10:00.000Z"),
    });
    const context = await getLevelDeviceContext(
      access("technician"),
      { assetId: ids.asset, propertyId: ids.property },
      new Date("2026-09-08T13:30:00.000Z"),
    );
    expect(context.state).toBe("degraded");
    expect(context.deviceId).toBe("level-current");
    expect(context.message).toContain("last synchronized snapshot");
  });

  it("contains query failure and leaves the parent ticket or asset usable", async () => {
    mocks.findLink.mockRejectedValue(new Error("database connection interrupted"));
    const context = await getLevelDeviceContext(access("technician"), {
      assetId: ids.asset,
      propertyId: ids.property,
    });
    expect(context.state).toBe("degraded");
    expect(context.message).toContain("ticket and asset record remain usable");
  });

  it("fails closed for every stored device URL until Level publishes a stable contract", async () => {
    expect(allowlistedLevelDeviceUrl("https://app.level.io/devices/level-current")).toBeNull();
    expect(allowlistedLevelDeviceUrl("https://evil.example/steal?device=level-current")).toBeNull();
    expect(allowlistedLevelDeviceUrl("javascript:alert(1)")).toBeNull();
    mocks.findLink.mockResolvedValue({
      organizationId: ids.organization,
      externalId: "level-current",
      externalUrl: "https://evil.example/steal",
    });
    const context = await getLevelDeviceContext(access("technician"), {
      assetId: ids.asset,
      propertyId: ids.property,
    });
    expect(context.deepLink).toBeNull();
  });

  it("follows the current asset link and ignores the replaced device snapshot", async () => {
    mocks.findLink.mockResolvedValue({
      organizationId: ids.organization,
      externalId: "level-replacement",
      externalUrl: null,
    });
    mocks.findDevice.mockResolvedValue({
      ...freshDevice,
      levelDeviceId: "level-replacement",
      hostname: "FRONT-DESK-02",
    });
    const context = await getLevelDeviceContext(access("technician"), {
      assetId: ids.asset,
      propertyId: ids.property,
    });
    expect(mocks.findDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_levelDeviceId: {
            organizationId: ids.organization,
            levelDeviceId: "level-replacement",
          },
        },
      }),
    );
    expect(context.deviceId).toBe("level-replacement");
    expect(context.deviceName).toBe("FRONT-DESK-02");
  });
});
