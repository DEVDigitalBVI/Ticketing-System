import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@/server/database/factory";
import { levelDeviceChecksum } from "@/server/integrations/level/inventory-policy";
import { PrismaLevelInventoryStore } from "@/server/integrations/level/inventory-store";

const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL is required for database tests.");
const client = createDatabaseClient(connectionString);
const store = new PrismaLevelInventoryStore();
const organizationId = "18b8d97e-9622-4ca7-b344-6230ad863e84";
const propertyId = "ab9c2f07-e909-4f9d-9092-49ad4e06df1f";

beforeAll(async () => client.$connect());
afterAll(async () => client.$disconnect());

describe("Step 21 Level inventory persistence", () => {
  it("repeating a sync creates no duplicate devices, assets, or external links", async () => {
    const suffix = crypto.randomUUID();
    const levelDeviceId = `level-${suffix}`;
    const serialNumber = `LEVEL-SERIAL-${suffix}`;
    const [type, status] = await Promise.all([
      client.assetType.findFirstOrThrow({ where: { organizationId, code: "workstation" } }),
      client.assetStatus.findFirstOrThrow({ where: { organizationId, code: "deployed" } }),
    ]);
    const asset = await client.asset.create({
      data: {
        organizationId,
        propertyId,
        assetTypeId: type.id,
        assetStatusId: status.id,
        assetTag: `LEVEL-${suffix}`,
        name: "Level idempotency test workstation",
        serialNumber,
      },
    });
    const device = {
      levelDeviceId,
      hostname: "Front Desk Workstation",
      serialNumber,
      manufacturer: "Example",
      model: "Model 1",
      platform: "Windows",
      online: true,
      lastSeenAt: new Date("2026-09-04T12:00:00Z"),
    };
    const checksum = levelDeviceChecksum(device);

    expect(
      await store.synchronizeDevice({
        organizationId,
        device,
        checksum,
        now: new Date("2026-09-04T12:01:00Z"),
      }),
    ).toBe("matched");
    expect(
      await store.synchronizeDevice({
        organizationId,
        device: { ...device, hostname: "Renamed Front Desk Workstation" },
        checksum: levelDeviceChecksum({ ...device, hostname: "Renamed Front Desk Workstation" }),
        now: new Date("2026-09-04T13:01:00Z"),
      }),
    ).toBe("matched");

    expect(
      await client.levelDeviceInventory.count({ where: { organizationId, levelDeviceId } }),
    ).toBe(1);
    expect(await client.asset.count({ where: { id: asset.id } })).toBe(1);
    expect(
      await client.externalSystemLink.count({
        where: { organizationId, systemKey: "level", externalId: levelDeviceId },
      }),
    ).toBe(1);
    expect(
      (
        await client.levelDeviceInventory.findFirstOrThrow({
          where: { organizationId, levelDeviceId },
        })
      ).hostname,
    ).toBe("Renamed Front Desk Workstation");
  });
});
