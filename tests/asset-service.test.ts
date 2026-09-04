import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  assetFindMany: vi.fn(),
  transaction: vi.fn(),
  propertyFindFirst: vi.fn(),
  assetFindFirst: vi.fn(),
  assetUpdateMany: vi.fn(),
  assignmentUpdateMany: vi.fn(),
  locationCreate: vi.fn(),
  auditCreate: vi.fn(),
}));

const tx = {
  property: { findFirst: mocks.propertyFindFirst },
  asset: { findFirst: mocks.assetFindFirst, updateMany: mocks.assetUpdateMany },
  buildingArea: { findFirst: vi.fn() },
  serviceLocation: { findFirst: vi.fn() },
  department: { findFirst: vi.fn() },
  user: { findFirst: vi.fn() },
  vendor: { findFirst: vi.fn() },
  assetType: { findFirst: vi.fn() },
  assetStatus: { findFirst: vi.fn() },
  assetAssignment: { updateMany: mocks.assignmentUpdateMany },
  assetLocationHistory: { create: mocks.locationCreate },
  auditEvent: { create: mocks.auditCreate },
};

vi.mock("@/server/database/client", () => ({
  database: {
    asset: { findMany: mocks.assetFindMany },
    $transaction: mocks.transaction,
  },
}));

import type { AccessProfile } from "@/server/auth/access";
import { AssetServiceError } from "@/server/assets/policy";
import { listAssets, transferAsset } from "@/server/assets/service";

const propertyOne = "11111111-1111-4111-8111-111111111111";
const propertyTwo = "22222222-2222-4222-8222-222222222222";
const assetId = "33333333-3333-4333-8333-333333333333";

function access(role: AccessProfile["roles"][number], properties = [propertyOne]): AccessProfile {
  return {
    userId: "44444444-4444-4444-8444-444444444444",
    authUserId: "55555555-5555-4555-8555-555555555555",
    email: "it@example.invalid",
    displayName: "IT Manager",
    organizationId: "66666666-6666-4666-8666-666666666666",
    organizationName: "Peter Island Resort and Spa",
    properties: properties.map((id) => ({ id, name: id })),
    departmentIds: [],
    roles: [role],
    assuranceLevel: "aal1",
    mustChangePassword: false,
  };
}

describe("asset inventory service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callback) => callback(tx));
    mocks.propertyFindFirst.mockResolvedValue({ id: propertyTwo });
    mocks.assetUpdateMany.mockResolvedValue({ count: 1 });
    mocks.assignmentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.locationCreate.mockResolvedValue({});
    mocks.auditCreate.mockResolvedValue({});
  });

  it("denies inventory reads without asset.read before querying", async () => {
    await expect(listAssets(access("requester"))).rejects.toEqual(new AssetServiceError("denied"));
    expect(mocks.assetFindMany).not.toHaveBeenCalled();
  });

  it("limits technician inventory reads to assigned properties", async () => {
    mocks.assetFindMany.mockResolvedValue([]);
    await listAssets(access("technician"), { query: "front desk" });
    expect(mocks.assetFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ propertyId: { in: [propertyOne] } }),
        take: 250,
      }),
    );
  });

  it("rejects transfers outside a manager's property scope", async () => {
    mocks.assetFindFirst.mockResolvedValue({
      id: assetId,
      organizationId: access("it_manager").organizationId,
      propertyId: propertyOne,
      buildingAreaId: null,
      serviceLocationId: null,
      departmentId: null,
      custodianUserId: null,
      retiredAt: null,
    });
    await expect(
      transferAsset(
        access("it_manager"),
        {
          assetId,
          propertyId: propertyTwo,
          reason: "Moved to another resort property",
          expectedUpdatedAt: "2026-09-04T14:00:00.000Z",
        },
        "77777777-7777-4777-8777-777777777777",
      ),
    ).rejects.toEqual(new AssetServiceError("not_found"));
    expect(mocks.assetUpdateMany).not.toHaveBeenCalled();
  });

  it("records both sides of an authorized property transfer and closes responsibility", async () => {
    const updatedAt = new Date("2026-09-04T14:00:00.000Z");
    mocks.assetFindFirst.mockResolvedValue({
      id: assetId,
      organizationId: access("it_manager").organizationId,
      propertyId: propertyOne,
      buildingAreaId: null,
      serviceLocationId: null,
      departmentId: null,
      custodianUserId: "88888888-8888-4888-8888-888888888888",
      retiredAt: null,
      updatedAt,
    });
    await transferAsset(
      access("it_manager", [propertyOne, propertyTwo]),
      {
        assetId,
        propertyId: propertyTwo,
        reason: "Reassigned to the marina office",
        expectedUpdatedAt: updatedAt.toISOString(),
      },
      "77777777-7777-4777-8777-777777777777",
    );
    expect(mocks.assetUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          propertyId: propertyTwo,
          custodianUserId: null,
          departmentId: null,
        }),
      }),
    );
    expect(mocks.locationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        assetId,
        fromPropertyId: propertyOne,
        toPropertyId: propertyTwo,
        reason: "Reassigned to the marina office",
      }),
    });
    expect(mocks.assignmentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ assetId, endedAt: null }) }),
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "asset.transferred", entityId: assetId }),
    });
  });

  it("detects concurrent edits at the exact optimistic-lock boundary", async () => {
    mocks.assetFindFirst.mockResolvedValue({
      id: assetId,
      organizationId: access("it_manager").organizationId,
      propertyId: propertyOne,
      buildingAreaId: null,
      serviceLocationId: null,
      departmentId: null,
      custodianUserId: null,
      retiredAt: null,
    });
    mocks.assetUpdateMany.mockResolvedValue({ count: 0 });
    await expect(
      transferAsset(
        access("it_manager"),
        {
          assetId,
          propertyId: propertyOne,
          reason: "Moved to storage",
          expectedUpdatedAt: "2026-09-04T14:00:00.000Z",
        },
        "77777777-7777-4777-8777-777777777777",
      ),
    ).rejects.toEqual(new AssetServiceError("conflict"));
    expect(mocks.locationCreate).not.toHaveBeenCalled();
  });
});
