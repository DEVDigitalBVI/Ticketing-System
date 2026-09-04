import { describe, expect, it } from "vitest";

import {
  assetAssignmentSchema,
  createAssetSchema,
  normalizeAssetTag,
  procurementSchema,
} from "@/server/assets/policy";

const ids = {
  type: "11111111-1111-4111-8111-111111111111",
  status: "22222222-2222-4222-8222-222222222222",
  property: "33333333-3333-4333-8333-333333333333",
};

describe("asset inventory policy", () => {
  it("normalizes the resort asset tag independently of serial numbers", () => {
    expect(normalizeAssetTag("  pir-it-0042 ")).toBe("PIR-IT-0042");
  });

  it("accepts an approved asset type with property and lifecycle context", () => {
    expect(
      createAssetSchema.safeParse({
        assetTag: "PIR-0042",
        serialNumber: "SN-9988",
        name: "Front desk workstation",
        assetTypeId: ids.type,
        assetStatusId: ids.status,
        propertyId: ids.property,
        criticality: "high",
        currencyCode: "USD",
      }).success,
    ).toBe(true);
  });

  it("rejects unsupported criticality values", () => {
    expect(
      createAssetSchema.safeParse({
        assetTag: "PIR-0042",
        name: "Front desk workstation",
        assetTypeId: ids.type,
        assetStatusId: ids.status,
        propertyId: ids.property,
        criticality: "urgent",
      }).success,
    ).toBe(false);
  });

  it("requires a department or custodian for an assignment", () => {
    expect(assetAssignmentSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a warranty end before its start", () => {
    expect(
      procurementSchema.safeParse({
        warrantyStart: "2026-09-04",
        warrantyEnd: "2026-09-03",
      }).success,
    ).toBe(false);
  });

  it("normalizes ISO currency codes and rejects malformed codes", () => {
    expect(procurementSchema.parse({ currencyCode: "usd" }).currencyCode).toBe("USD");
    expect(procurementSchema.safeParse({ currencyCode: "US" }).success).toBe(false);
  });
});
