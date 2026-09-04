import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { AccessProfile } from "@/server/auth/access";
import { accessCan } from "@/server/auth/authorization";
import { database } from "@/server/database/client";
import { AuditEventRepository } from "@/server/repositories/audit-event-repository";
import {
  AssetServiceError,
  assignAssetSchema,
  createAssetSchema,
  editAssetSchema,
  normalizeAssetTag,
  retireAssetSchema,
  transferAssetSchema,
} from "@/server/assets/policy";

const assetInclude = {
  assetType: true,
  assetStatus: true,
  property: true,
  buildingArea: true,
  serviceLocation: true,
  department: true,
  custodian: { select: { id: true, displayName: true, email: true } },
  procurement: { include: { vendor: true } },
} satisfies Prisma.AssetInclude;

function canUseProperty(
  access: AccessProfile,
  propertyId: string,
  permission: "asset.read" | "asset.manage",
) {
  return accessCan(access, permission, {
    organizationId: access.organizationId,
    propertyId,
  });
}

function activePropertyIds(access: AccessProfile) {
  return access.roles.includes("system_administrator")
    ? undefined
    : access.properties.map((property) => property.id);
}

function parseOrThrow<T>(result: { success: true; data: T } | { success: false }): T {
  if (!result.success) throw new AssetServiceError("invalid");
  return result.data;
}

function isUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function validateReferences(
  tx: Prisma.TransactionClient,
  organizationId: string,
  input: {
    assetTypeId?: string;
    assetStatusId?: string;
    propertyId: string;
    buildingAreaId?: string;
    serviceLocationId?: string;
    departmentId?: string;
    custodianUserId?: string;
    vendorId?: string;
  },
) {
  const [property, type, status, building, location, department, custodian, vendor] =
    await Promise.all([
      tx.property.findFirst({ where: { id: input.propertyId, organizationId, isActive: true } }),
      input.assetTypeId
        ? tx.assetType.findFirst({
            where: { id: input.assetTypeId, organizationId, isActive: true },
          })
        : true,
      input.assetStatusId
        ? tx.assetStatus.findFirst({
            where: { id: input.assetStatusId, organizationId, isActive: true },
          })
        : true,
      input.buildingAreaId
        ? tx.buildingArea.findFirst({
            where: {
              id: input.buildingAreaId,
              propertyId: input.propertyId,
              organizationId,
              isActive: true,
            },
          })
        : true,
      input.serviceLocationId
        ? tx.serviceLocation.findFirst({
            where: {
              id: input.serviceLocationId,
              buildingAreaId: input.buildingAreaId,
              propertyId: input.propertyId,
              organizationId,
              isActive: true,
            },
          })
        : true,
      input.departmentId
        ? tx.department.findFirst({
            where: {
              id: input.departmentId,
              propertyId: input.propertyId,
              organizationId,
              isActive: true,
            },
          })
        : true,
      input.custodianUserId
        ? tx.user.findFirst({
            where: {
              id: input.custodianUserId,
              organizationId,
              isActive: true,
              roles: { some: { propertyId: input.propertyId } },
            },
          })
        : true,
      input.vendorId
        ? tx.vendor.findFirst({ where: { id: input.vendorId, organizationId, isActive: true } })
        : true,
    ]);
  if ([property, type, status, building, location, department, custodian, vendor].includes(null))
    throw new AssetServiceError("invalid");
  if (input.serviceLocationId && !input.buildingAreaId) throw new AssetServiceError("invalid");
  return { status: typeof status === "boolean" ? undefined : status };
}

async function audit(
  tx: Prisma.TransactionClient,
  access: AccessProfile,
  propertyId: string,
  correlationId: string,
  action: string,
  assetId: string,
  metadata: Prisma.InputJsonObject,
) {
  await new AuditEventRepository(tx).record({
    organizationId: access.organizationId,
    propertyId,
    actorUserId: access.userId,
    action,
    entityType: "asset",
    entityId: assetId,
    result: "success",
    correlationId,
    metadata,
  });
}

export async function listAssets(
  access: AccessProfile,
  filters: { query?: string; propertyId?: string; status?: string; type?: string } = {},
) {
  if (!accessCan(access, "asset.read")) throw new AssetServiceError("denied");
  if (filters.propertyId && !canUseProperty(access, filters.propertyId, "asset.read"))
    throw new AssetServiceError("denied");
  const propertyIds = filters.propertyId ? [filters.propertyId] : activePropertyIds(access);
  const query = filters.query?.trim();
  return database.asset.findMany({
    where: {
      organizationId: access.organizationId,
      ...(propertyIds ? { propertyId: { in: propertyIds } } : {}),
      ...(filters.status ? { assetStatus: { code: filters.status } } : {}),
      ...(filters.type ? { assetType: { code: filters.type } } : {}),
      ...(query
        ? {
            OR: [
              { assetTag: { contains: query, mode: "insensitive" } },
              { serialNumber: { contains: query, mode: "insensitive" } },
              { name: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: assetInclude,
    orderBy: [{ assetStatus: { isTerminal: "asc" } }, { assetTag: "asc" }],
    take: 250,
  });
}

export async function getAssetDetail(access: AccessProfile, assetId: string) {
  if (!accessCan(access, "asset.read")) throw new AssetServiceError("denied");
  const asset = await database.asset.findFirst({
    where: { id: assetId, organizationId: access.organizationId },
    include: {
      ...assetInclude,
      assignments: {
        include: {
          custodian: { select: { displayName: true } },
          department: { select: { name: true } },
          assignedBy: { select: { displayName: true } },
        },
        orderBy: { assignedAt: "desc" },
      },
      locationHistory: {
        include: {
          fromProperty: true,
          fromBuildingArea: true,
          fromServiceLocation: true,
          toProperty: true,
          toBuildingArea: true,
          toServiceLocation: true,
          movedBy: { select: { displayName: true } },
        },
        orderBy: { movedAt: "desc" },
      },
      externalLinks: { orderBy: { systemKey: "asc" } },
    },
  });
  if (!asset || !canUseProperty(access, asset.propertyId, "asset.read"))
    throw new AssetServiceError("not_found");
  return asset;
}

export async function getAssetFormOptions(access: AccessProfile) {
  if (!accessCan(access, "asset.read")) throw new AssetServiceError("denied");
  const propertyIds = activePropertyIds(access);
  const organizationId = access.organizationId;
  const propertyWhere = {
    organizationId,
    isActive: true,
    ...(propertyIds ? { id: { in: propertyIds } } : {}),
  };
  const [properties, buildings, locations, departments, rawUsers, types, statuses, vendors] =
    await Promise.all([
      database.property.findMany({ where: propertyWhere, orderBy: { name: "asc" } }),
      database.buildingArea.findMany({
        where: {
          organizationId,
          isActive: true,
          ...(propertyIds ? { propertyId: { in: propertyIds } } : {}),
        },
        orderBy: { name: "asc" },
      }),
      database.serviceLocation.findMany({
        where: {
          organizationId,
          isActive: true,
          ...(propertyIds ? { propertyId: { in: propertyIds } } : {}),
        },
        orderBy: { name: "asc" },
      }),
      database.department.findMany({
        where: {
          organizationId,
          isActive: true,
          ...(propertyIds ? { propertyId: { in: propertyIds } } : {}),
        },
        orderBy: { name: "asc" },
      }),
      database.user.findMany({
        where: {
          organizationId,
          isActive: true,
          ...(propertyIds ? { roles: { some: { propertyId: { in: propertyIds } } } } : {}),
        },
        select: {
          id: true,
          displayName: true,
          email: true,
          roles: { select: { propertyId: true } },
        },
        orderBy: { displayName: "asc" },
      }),
      database.assetType.findMany({
        where: { organizationId, isActive: true },
        orderBy: { name: "asc" },
      }),
      database.assetStatus.findMany({
        where: { organizationId, isActive: true },
        orderBy: { name: "asc" },
      }),
      database.vendor.findMany({
        where: { organizationId, isActive: true },
        orderBy: { name: "asc" },
      }),
    ]);
  const users = rawUsers.map(({ roles, ...user }) => ({
    ...user,
    propertyIds: [...new Set(roles.map((role) => role.propertyId))],
  }));
  return { properties, buildings, locations, departments, users, types, statuses, vendors };
}

export async function createAsset(access: AccessProfile, raw: unknown, correlationId: string) {
  const input = parseOrThrow(createAssetSchema.safeParse(raw));
  if (!canUseProperty(access, input.propertyId, "asset.manage"))
    throw new AssetServiceError("denied");
  const now = new Date();
  try {
    return await database.$transaction(async (tx) => {
      const references = await validateReferences(tx, access.organizationId, input);
      if (references.status?.isTerminal) throw new AssetServiceError("invalid");
      const asset = await tx.asset.create({
        data: {
          organizationId: access.organizationId,
          assetTag: normalizeAssetTag(input.assetTag),
          serialNumber: input.serialNumber,
          name: input.name,
          description: input.description,
          assetTypeId: input.assetTypeId,
          assetStatusId: input.assetStatusId,
          propertyId: input.propertyId,
          buildingAreaId: input.buildingAreaId,
          serviceLocationId: input.serviceLocationId,
          departmentId: input.departmentId,
          custodianUserId: input.custodianUserId,
          criticality: input.criticality,
          manufacturer: input.manufacturer,
          model: input.model,
          acquiredAt: input.acquiredAt,
        },
      });
      await tx.assetLocationHistory.create({
        data: {
          organizationId: access.organizationId,
          assetId: asset.id,
          toPropertyId: input.propertyId,
          toBuildingAreaId: input.buildingAreaId,
          toServiceLocationId: input.serviceLocationId,
          movedByUserId: access.userId,
          reason: "Initial inventory location",
          movedAt: now,
        },
      });
      if (input.custodianUserId || input.departmentId) {
        await tx.assetAssignment.create({
          data: {
            organizationId: access.organizationId,
            assetId: asset.id,
            propertyId: input.propertyId,
            custodianUserId: input.custodianUserId,
            departmentId: input.departmentId,
            assignedByUserId: access.userId,
            note: "Initial inventory assignment",
            assignedAt: now,
          },
        });
      }
      if (
        input.vendorId ||
        input.purchaseDate ||
        input.purchaseCost !== undefined ||
        input.purchaseOrder ||
        input.warrantyStart ||
        input.warrantyEnd ||
        input.warrantyReference ||
        input.procurementNotes
      ) {
        await tx.procurementMetadata.create({
          data: {
            organizationId: access.organizationId,
            assetId: asset.id,
            vendorId: input.vendorId,
            purchaseDate: input.purchaseDate,
            purchaseCost: input.purchaseCost,
            currencyCode: input.currencyCode || undefined,
            purchaseOrder: input.purchaseOrder,
            warrantyStart: input.warrantyStart,
            warrantyEnd: input.warrantyEnd,
            warrantyReference: input.warrantyReference,
            notes: input.procurementNotes,
          },
        });
      }
      await audit(tx, access, input.propertyId, correlationId, "asset.created", asset.id, {
        assetTag: asset.assetTag,
        criticality: asset.criticality,
      });
      return asset;
    });
  } catch (error) {
    if (error instanceof AssetServiceError) throw error;
    if (isUniqueError(error)) throw new AssetServiceError("conflict");
    throw error;
  }
}

function procurementData(input: ReturnType<typeof editAssetSchema.parse>) {
  return {
    vendorId: input.vendorId,
    purchaseDate: input.purchaseDate,
    purchaseCost: input.purchaseCost,
    currencyCode: input.currencyCode || null,
    purchaseOrder: input.purchaseOrder,
    warrantyStart: input.warrantyStart,
    warrantyEnd: input.warrantyEnd,
    warrantyReference: input.warrantyReference,
    notes: input.procurementNotes,
  };
}

export async function editAsset(access: AccessProfile, raw: unknown, correlationId: string) {
  const input = parseOrThrow(editAssetSchema.safeParse(raw));
  try {
    return await database.$transaction(async (tx) => {
      const current = await tx.asset.findFirst({
        where: { id: input.assetId, organizationId: access.organizationId },
        include: { assetStatus: true },
      });
      if (!current || !canUseProperty(access, current.propertyId, "asset.manage"))
        throw new AssetServiceError("not_found");
      if (current.retiredAt) throw new AssetServiceError("retired");
      const references = await validateReferences(tx, access.organizationId, {
        propertyId: current.propertyId,
        assetTypeId: input.assetTypeId,
        assetStatusId: input.assetStatusId,
        vendorId: input.vendorId,
      });
      if (references.status?.isTerminal) throw new AssetServiceError("invalid");
      const changed = await tx.asset.updateMany({
        where: {
          id: current.id,
          organizationId: access.organizationId,
          updatedAt: new Date(input.expectedUpdatedAt),
        },
        data: {
          assetTag: normalizeAssetTag(input.assetTag),
          serialNumber: input.serialNumber ?? null,
          name: input.name,
          description: input.description ?? null,
          assetTypeId: input.assetTypeId,
          assetStatusId: input.assetStatusId,
          criticality: input.criticality,
          manufacturer: input.manufacturer ?? null,
          model: input.model ?? null,
          acquiredAt: input.acquiredAt ?? null,
        },
      });
      if (changed.count !== 1) throw new AssetServiceError("conflict");
      await tx.procurementMetadata.upsert({
        where: { assetId: current.id },
        create: {
          organizationId: access.organizationId,
          assetId: current.id,
          ...procurementData(input),
        },
        update: procurementData(input),
      });
      await audit(tx, access, current.propertyId, correlationId, "asset.updated", current.id, {
        assetTag: normalizeAssetTag(input.assetTag),
      });
      return tx.asset.findUniqueOrThrow({ where: { id: current.id } });
    });
  } catch (error) {
    if (error instanceof AssetServiceError) throw error;
    if (isUniqueError(error)) throw new AssetServiceError("conflict");
    throw error;
  }
}

export async function transferAsset(access: AccessProfile, raw: unknown, correlationId: string) {
  const input = parseOrThrow(transferAssetSchema.safeParse(raw));
  return database.$transaction(async (tx) => {
    const current = await tx.asset.findFirst({
      where: { id: input.assetId, organizationId: access.organizationId },
    });
    if (
      !current ||
      !canUseProperty(access, current.propertyId, "asset.manage") ||
      !canUseProperty(access, input.propertyId, "asset.manage")
    )
      throw new AssetServiceError("not_found");
    if (current.retiredAt) throw new AssetServiceError("retired");
    await validateReferences(tx, access.organizationId, input);
    const movedAt = new Date();
    const changed = await tx.asset.updateMany({
      where: {
        id: current.id,
        organizationId: access.organizationId,
        updatedAt: new Date(input.expectedUpdatedAt),
      },
      data: {
        propertyId: input.propertyId,
        buildingAreaId: input.buildingAreaId ?? null,
        serviceLocationId: input.serviceLocationId ?? null,
        departmentId: current.propertyId === input.propertyId ? current.departmentId : null,
        custodianUserId: current.propertyId === input.propertyId ? current.custodianUserId : null,
      },
    });
    if (changed.count !== 1) throw new AssetServiceError("conflict");
    if (current.propertyId !== input.propertyId) {
      await tx.assetAssignment.updateMany({
        where: { assetId: current.id, organizationId: access.organizationId, endedAt: null },
        data: { endedAt: movedAt },
      });
    }
    await tx.assetLocationHistory.create({
      data: {
        organizationId: access.organizationId,
        assetId: current.id,
        fromPropertyId: current.propertyId,
        fromBuildingAreaId: current.buildingAreaId,
        fromServiceLocationId: current.serviceLocationId,
        toPropertyId: input.propertyId,
        toBuildingAreaId: input.buildingAreaId,
        toServiceLocationId: input.serviceLocationId,
        movedByUserId: access.userId,
        reason: input.reason,
        movedAt,
      },
    });
    await audit(tx, access, input.propertyId, correlationId, "asset.transferred", current.id, {
      fromPropertyId: current.propertyId,
      toPropertyId: input.propertyId,
    });
  });
}

export async function assignAsset(access: AccessProfile, raw: unknown, correlationId: string) {
  const input = parseOrThrow(assignAssetSchema.safeParse(raw));
  return database.$transaction(async (tx) => {
    const current = await tx.asset.findFirst({
      where: { id: input.assetId, organizationId: access.organizationId },
    });
    if (!current || !canUseProperty(access, current.propertyId, "asset.manage"))
      throw new AssetServiceError("not_found");
    if (current.retiredAt) throw new AssetServiceError("retired");
    await validateReferences(tx, access.organizationId, {
      propertyId: current.propertyId,
      departmentId: input.departmentId,
      custodianUserId: input.custodianUserId,
    });
    const assignedAt = new Date();
    const changed = await tx.asset.updateMany({
      where: {
        id: current.id,
        organizationId: access.organizationId,
        updatedAt: new Date(input.expectedUpdatedAt),
      },
      data: {
        custodianUserId: input.custodianUserId ?? null,
        departmentId: input.departmentId ?? null,
      },
    });
    if (changed.count !== 1) throw new AssetServiceError("conflict");
    await tx.assetAssignment.updateMany({
      where: { assetId: current.id, organizationId: access.organizationId, endedAt: null },
      data: { endedAt: assignedAt },
    });
    await tx.assetAssignment.create({
      data: {
        organizationId: access.organizationId,
        assetId: current.id,
        propertyId: current.propertyId,
        custodianUserId: input.custodianUserId,
        departmentId: input.departmentId,
        assignedByUserId: access.userId,
        note: input.note,
        assignedAt,
      },
    });
    await audit(tx, access, current.propertyId, correlationId, "asset.assigned", current.id, {
      custodianUserId: input.custodianUserId ?? null,
      departmentId: input.departmentId ?? null,
    });
  });
}

export async function retireAsset(access: AccessProfile, raw: unknown, correlationId: string) {
  const input = parseOrThrow(retireAssetSchema.safeParse(raw));
  return database.$transaction(async (tx) => {
    const current = await tx.asset.findFirst({
      where: { id: input.assetId, organizationId: access.organizationId },
    });
    if (!current || !canUseProperty(access, current.propertyId, "asset.manage"))
      throw new AssetServiceError("not_found");
    if (current.retiredAt) throw new AssetServiceError("retired");
    const retiredStatus = await tx.assetStatus.findFirst({
      where: {
        organizationId: access.organizationId,
        code: "retired",
        isActive: true,
        isTerminal: true,
      },
    });
    if (!retiredStatus) throw new AssetServiceError("invalid");
    const retiredAt = new Date();
    const changed = await tx.asset.updateMany({
      where: {
        id: current.id,
        organizationId: access.organizationId,
        updatedAt: new Date(input.expectedUpdatedAt),
        retiredAt: null,
      },
      data: {
        assetStatusId: retiredStatus.id,
        retiredAt,
        retirementReason: input.reason,
        custodianUserId: null,
        departmentId: null,
      },
    });
    if (changed.count !== 1) throw new AssetServiceError("conflict");
    await tx.assetAssignment.updateMany({
      where: { assetId: current.id, organizationId: access.organizationId, endedAt: null },
      data: { endedAt: retiredAt },
    });
    await audit(tx, access, current.propertyId, correlationId, "asset.retired", current.id, {
      reason: input.reason,
    });
  });
}
