import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AccessProfile } from "@/server/auth/access";
import { createAsset, getAssetDetail, retireAsset, transferAsset } from "@/server/assets/service";
import { createDatabaseClient } from "@/server/database/factory";

const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL is required for database tests.");
const client = createDatabaseClient(connectionString);

const ids = {
  organization: "18b8d97e-9622-4ca7-b344-6230ad863e84",
  property: "ab9c2f07-e909-4f9d-9092-49ad4e06df1f",
  manager: "c0981aea-47c8-4dc9-9c9c-0d611e94a4d8",
};

const manager: AccessProfile = {
  userId: ids.manager,
  authUserId: crypto.randomUUID(),
  email: "asset-manager@example.invalid",
  displayName: "Asset Manager",
  organizationId: ids.organization,
  organizationName: "Peter Island Resort and Spa",
  properties: [{ id: ids.property, name: "Peter Island Resort and Spa" }],
  departmentIds: [],
  roles: ["system_administrator"],
  assuranceLevel: "aal2",
  mustChangePassword: false,
};

beforeAll(async () => {
  await client.$connect();
  await client.user.upsert({
    where: { id: ids.manager },
    create: {
      id: ids.manager,
      organizationId: ids.organization,
      email: manager.email,
      displayName: manager.displayName,
      mustChangePassword: false,
    },
    update: {},
  });
});

afterAll(async () => client.$disconnect());

describe("Step 15 asset inventory", () => {
  it("creates a traceable asset with an initial location event", async () => {
    const [type, status] = await Promise.all([
      client.assetType.findFirstOrThrow({
        where: { organizationId: ids.organization, code: "laptop" },
      }),
      client.assetStatus.findFirstOrThrow({
        where: { organizationId: ids.organization, code: "deployed" },
      }),
    ]);
    const asset = await createAsset(
      manager,
      {
        assetTag: "pir-test-asset-15",
        serialNumber: "STEP15-SERIAL-001",
        name: "Step 15 test laptop",
        assetTypeId: type.id,
        assetStatusId: status.id,
        propertyId: ids.property,
        criticality: "high",
        currencyCode: "USD",
      },
      crypto.randomUUID(),
    );
    const detail = await getAssetDetail(manager, asset.id);
    expect(detail.assetTag).toBe("PIR-TEST-ASSET-15");
    expect(detail.serialNumber).toBe("STEP15-SERIAL-001");
    expect(detail.locationHistory).toHaveLength(1);
    expect(detail.locationHistory[0]?.toPropertyId).toBe(ids.property);
  });

  it("enforces case-insensitive resort tag and serial uniqueness", async () => {
    const existing = await client.asset.findFirstOrThrow({
      where: { assetTag: "PIR-TEST-ASSET-15" },
    });
    await expect(
      client.asset.create({
        data: {
          organizationId: ids.organization,
          assetTag: "pir-test-asset-15",
          serialNumber: "different",
          name: "Duplicate tag",
          assetTypeId: existing.assetTypeId,
          assetStatusId: existing.assetStatusId,
          propertyId: ids.property,
        },
      }),
    ).rejects.toBeTruthy();
    await expect(
      client.asset.create({
        data: {
          organizationId: ids.organization,
          assetTag: "PIR-TEST-ASSET-16",
          serialNumber: "step15-serial-001",
          name: "Duplicate serial",
          assetTypeId: existing.assetTypeId,
          assetStatusId: existing.assetStatusId,
          propertyId: ids.property,
        },
      }),
    ).rejects.toBeTruthy();
  });

  it("records exact move history and preserves retired records", async () => {
    const asset = await client.asset.findFirstOrThrow({ where: { assetTag: "PIR-TEST-ASSET-15" } });
    await transferAsset(
      manager,
      {
        assetId: asset.id,
        propertyId: ids.property,
        reason: "Moved to the IT staging area",
        expectedUpdatedAt: asset.updatedAt.toISOString(),
      },
      crypto.randomUUID(),
    );
    const moved = await client.asset.findUniqueOrThrow({ where: { id: asset.id } });
    await retireAsset(
      manager,
      {
        assetId: moved.id,
        reason: "End of useful life",
        expectedUpdatedAt: moved.updatedAt.toISOString(),
      },
      crypto.randomUUID(),
    );
    const detail = await getAssetDetail(manager, asset.id);
    expect(detail.assetStatus.code).toBe("retired");
    expect(detail.retirementReason).toBe("End of useful life");
    expect(detail.locationHistory.map((item) => item.reason)).toContain(
      "Moved to the IT staging area",
    );
    await expect(client.asset.delete({ where: { id: asset.id } })).rejects.toBeTruthy();
    await expect(
      client.assetLocationHistory.update({
        where: { id: detail.locationHistory[0]!.id },
        data: { reason: "Rewritten history" },
      }),
    ).rejects.toBeTruthy();
  });
});
