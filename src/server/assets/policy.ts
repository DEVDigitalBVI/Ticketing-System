import { z } from "zod";

export const assetCriticalities = ["low", "standard", "high", "mission_critical"] as const;

const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(maximum).optional(),
  );
const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().uuid().optional(),
);
const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.date().optional(),
);

export const assetCoreSchema = z.object({
  assetTag: z.string().trim().min(2).max(50),
  serialNumber: optionalText(120),
  name: z.string().trim().min(2).max(160),
  description: optionalText(2000),
  assetTypeId: z.string().uuid(),
  assetStatusId: z.string().uuid(),
  criticality: z.enum(assetCriticalities),
  manufacturer: optionalText(120),
  model: optionalText(120),
  acquiredAt: optionalDate,
});

export const assetLocationSchema = z.object({
  propertyId: z.string().uuid(),
  buildingAreaId: optionalUuid,
  serviceLocationId: optionalUuid,
});

export const assetAssignmentSchema = z
  .object({
    custodianUserId: optionalUuid,
    departmentId: optionalUuid,
    note: optionalText(1000),
  })
  .refine((value) => value.custodianUserId || value.departmentId, {
    message: "Choose a custodian or department.",
  });

export const procurementSchema = z
  .object({
    vendorId: optionalUuid,
    purchaseDate: optionalDate,
    purchaseCost: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.coerce.number().min(0).max(9999999999.99).optional(),
    ),
    currencyCode: z.preprocess(
      (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
      z
        .string()
        .regex(/^[A-Z]{3}$/)
        .optional()
        .or(z.literal("")),
    ),
    purchaseOrder: optionalText(120),
    warrantyStart: optionalDate,
    warrantyEnd: optionalDate,
    warrantyReference: optionalText(160),
    procurementNotes: optionalText(2000),
  })
  .refine(
    (value) =>
      !value.warrantyStart || !value.warrantyEnd || value.warrantyEnd >= value.warrantyStart,
    { message: "Warranty end must not precede warranty start.", path: ["warrantyEnd"] },
  );

export const createAssetSchema = assetCoreSchema
  .and(assetLocationSchema)
  .and(
    z.object({
      custodianUserId: optionalUuid,
      departmentId: optionalUuid,
    }),
  )
  .and(procurementSchema);

export const editAssetSchema = assetCoreSchema.and(procurementSchema).and(
  z.object({
    assetId: z.string().uuid(),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
  }),
);

export const transferAssetSchema = assetLocationSchema.and(
  z.object({
    assetId: z.string().uuid(),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    reason: z.string().trim().min(2).max(1000),
  }),
);

export const assignAssetSchema = assetAssignmentSchema.and(
  z.object({
    assetId: z.string().uuid(),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
  }),
);

export const retireAssetSchema = z.object({
  assetId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  reason: z.string().trim().min(2).max(1000),
});

export function normalizeAssetTag(value: string) {
  return value.trim().toUpperCase();
}

export class AssetServiceError extends Error {
  constructor(readonly code: "denied" | "invalid" | "not_found" | "conflict" | "retired") {
    super(code);
    this.name = "AssetServiceError";
  }
}
