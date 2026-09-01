import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  buildingAreaKinds,
  configurationEntityTypes,
  type ConfigurationEntityType,
  serviceLocationKinds,
} from "@/modules/admin/configuration";
import { accessCan } from "@/server/auth/authorization";
import type { AccessProfile } from "@/server/auth/access";
import { AuditEventRepository } from "@/server/repositories/audit-event-repository";
import { ConfigurationRepository } from "@/server/repositories/configuration-repository";
import { database } from "@/server/database/client";
import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);

const nameSchema = z.string().trim().min(2).max(120);
const uuidSchema = z.string().uuid();
const optionalUuidSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().uuid().optional(),
);
const timezoneValues = new Set(Intl.supportedValuesOf("timeZone"));
const timezoneSchema = z
  .string()
  .trim()
  .refine((value) => timezoneValues.has(value), "Invalid timezone.");

const mutationEnvelopeSchema = z.object({
  intent: z.enum(["create", "update", "deactivate"]),
  entityType: z.enum(configurationEntityTypes),
  id: optionalUuidSchema,
});

const propertySchema = z.object({
  code: codeSchema,
  name: nameSchema,
  timezone: timezoneSchema,
});

const buildingAreaSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  propertyId: uuidSchema,
  kind: z.enum(buildingAreaKinds),
});

const serviceLocationSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  propertyId: uuidSchema,
  buildingAreaId: uuidSchema,
  kind: z.enum(serviceLocationKinds),
});

const departmentSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  propertyId: uuidSchema,
});

const supportTeamSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  propertyId: uuidSchema,
  departmentId: optionalUuidSchema,
});

const ticketCategorySchema = z.object({
  code: codeSchema,
  name: nameSchema,
});

const ticketSubcategorySchema = z.object({
  code: codeSchema,
  name: nameSchema,
  categoryId: uuidSchema,
});

type MutationIntent = z.infer<typeof mutationEnvelopeSchema>["intent"];

export type ConfigurationCatalog = {
  properties: Array<{
    id: string;
    code: string;
    name: string;
    timezone: string;
    isActive: boolean;
  }>;
  buildingAreas: Array<{
    id: string;
    propertyId: string;
    propertyName: string;
    code: string;
    name: string;
    kind: "building" | "area";
    isActive: boolean;
  }>;
  serviceLocations: Array<{
    id: string;
    propertyId: string;
    propertyName: string;
    buildingAreaId: string;
    buildingAreaName: string;
    buildingAreaKind: string;
    code: string;
    name: string;
    kind: "room" | "service_location";
    isActive: boolean;
  }>;
  departments: Array<{
    id: string;
    propertyId: string;
    propertyName: string;
    code: string;
    name: string;
    isActive: boolean;
  }>;
  supportTeams: Array<{
    id: string;
    propertyId: string;
    propertyName: string;
    departmentId: string | null;
    departmentName: string | null;
    code: string;
    name: string;
    isActive: boolean;
  }>;
  ticketCategories: Array<{
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  }>;
  ticketSubcategories: Array<{
    id: string;
    categoryId: string;
    categoryName: string;
    code: string;
    name: string;
    isActive: boolean;
  }>;
};

export class ConfigurationMutationError extends Error {
  constructor(
    readonly code:
      | "denied"
      | "mfa"
      | "invalid"
      | "not_found"
      | "duplicate"
      | "linked"
      | "failed",
    readonly entityType: ConfigurationEntityType,
    readonly id?: string,
  ) {
    super(code);
    this.name = "ConfigurationMutationError";
  }
}

function requireManageAccess(access: AccessProfile, entityType: ConfigurationEntityType, propertyId?: string) {
  const allowed = accessCan(access, "configuration.manage", {
    organizationId: access.organizationId,
    propertyId,
  });
  if (!allowed) throw new ConfigurationMutationError("denied", entityType);
  if (access.assuranceLevel !== "aal2" || access.mustChangePassword)
    throw new ConfigurationMutationError("mfa", entityType);
}

function parseEnvelope(formData: FormData) {
  return mutationEnvelopeSchema.safeParse({
    intent: formData.get("intent"),
    entityType: formData.get("entityType"),
    id: formData.get("id"),
  });
}

function parseOrThrow<T>(
  result: z.ZodSafeParseResult<T>,
  entityType: ConfigurationEntityType,
  id?: string,
) {
  if (!result.success) throw new ConfigurationMutationError("invalid", entityType, id);
  return result.data;
}

function toAuditMetadata(
  data: Record<string, string | number | boolean | null | undefined>,
): Prisma.InputJsonObject {
  const entries = Object.entries(data).filter((entry): entry is [string, string | number | boolean | null] => entry[1] !== undefined);
  return Object.fromEntries(entries);
}

function auditAction(entityType: ConfigurationEntityType, intent: MutationIntent) {
  if (intent === "deactivate") return `configuration.${entityType}.deactivated`;
  return `configuration.${entityType}.${intent === "create" ? "created" : "updated"}`;
}

function friendlyDatabaseError(error: unknown, entityType: ConfigurationEntityType, id?: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ConfigurationMutationError("duplicate", entityType, id);
  }
  throw error;
}

export async function listConfigurationCatalog(organizationId: string): Promise<ConfigurationCatalog> {
  const repository = new ConfigurationRepository(database);
  const [
    properties,
    buildingAreas,
    serviceLocations,
    departments,
    supportTeams,
    ticketCategories,
    ticketSubcategories,
  ] = await Promise.all([
    repository.listProperties(organizationId),
    repository.listBuildingAreas(organizationId),
    repository.listServiceLocations(organizationId),
    repository.listDepartments(organizationId),
    repository.listSupportTeams(organizationId),
    repository.listTicketCategories(organizationId),
    repository.listTicketSubcategories(organizationId),
  ]);

  return {
    properties: properties.map((record) => ({
      id: record.id,
      code: record.code,
      name: record.name,
      timezone: record.timezone,
      isActive: record.isActive,
    })),
    buildingAreas: buildingAreas.map((record) => ({
      id: record.id,
      propertyId: record.propertyId,
      propertyName: record.property.name,
      code: record.code,
      name: record.name,
      kind: record.kind as "building" | "area",
      isActive: record.isActive,
    })),
    serviceLocations: serviceLocations.map((record) => ({
      id: record.id,
      propertyId: record.propertyId,
      propertyName: record.property.name,
      buildingAreaId: record.buildingAreaId,
      buildingAreaName: record.buildingArea.name,
      buildingAreaKind: record.buildingArea.kind,
      code: record.code,
      name: record.name,
      kind: record.kind as "room" | "service_location",
      isActive: record.isActive,
    })),
    departments: departments.map((record) => ({
      id: record.id,
      propertyId: record.propertyId,
      propertyName: record.property.name,
      code: record.code,
      name: record.name,
      isActive: record.isActive,
    })),
    supportTeams: supportTeams.map((record) => ({
      id: record.id,
      propertyId: record.propertyId,
      propertyName: record.property.name,
      departmentId: record.departmentId,
      departmentName: record.department?.name ?? null,
      code: record.code,
      name: record.name,
      isActive: record.isActive,
    })),
    ticketCategories: ticketCategories.map((record) => ({
      id: record.id,
      code: record.code,
      name: record.name,
      isActive: record.isActive,
    })),
    ticketSubcategories: ticketSubcategories.map((record) => ({
      id: record.id,
      categoryId: record.categoryId,
      categoryName: record.category.name,
      code: record.code,
      name: record.name,
      isActive: record.isActive,
    })),
  };
}

async function recordAudit(
  auditRepository: AuditEventRepository,
  access: AccessProfile,
  correlationId: string,
  entityType: ConfigurationEntityType,
  entityId: string,
  propertyId: string | null,
  metadata: Prisma.InputJsonObject,
  intent: MutationIntent,
) {
  await auditRepository.record({
    organizationId: access.organizationId,
    propertyId: propertyId ?? undefined,
    actorUserId: access.userId,
    action: auditAction(entityType, intent),
    entityType,
    entityId,
    result: "success",
    correlationId,
    metadata,
  });
}

export async function mutateConfiguration(
  access: AccessProfile,
  formData: FormData,
  correlationId: string,
) {
  const { entityType, intent, id } = parseOrThrow(parseEnvelope(formData), "property");

  return database.$transaction(async (transaction) => {
    const repository = new ConfigurationRepository(transaction);
    const auditRepository = new AuditEventRepository(transaction);

    switch (entityType) {
      case "property": {
        requireManageAccess(access, entityType);
        if (intent === "deactivate") {
          if (!id) throw new ConfigurationMutationError("invalid", entityType);
          const current = await repository.findProperty(id, access.organizationId);
          if (!current) throw new ConfigurationMutationError("not_found", entityType, id);
          const [buildingAreas, locations, departments, teams, userRoles] =
            await repository.countActivePropertyDependents(id, access.organizationId);
          if (buildingAreas || locations || departments || teams || userRoles)
            throw new ConfigurationMutationError("linked", entityType, id);
          if (current.isActive) {
            await repository.updateProperty(id, access.organizationId, { isActive: false });
            await recordAudit(auditRepository, access, correlationId, entityType, id, id, { code: current.code, name: current.name }, intent);
          }
          return { entityType, intent };
        }

        const input = parseOrThrow(
          propertySchema.safeParse({
          code: formData.get("code"),
          name: formData.get("name"),
          timezone: formData.get("timezone"),
          }),
          entityType,
          id,
        );
        const duplicate = await repository.findActivePropertyByCodeOrName(
          access.organizationId,
          input.code,
          input.name,
          intent === "update" ? id : undefined,
        );
        if (duplicate) throw new ConfigurationMutationError("duplicate", entityType, id);
        try {
          if (intent === "create") {
            const created = await repository.createProperty({
              organizationId: access.organizationId,
              code: input.code,
              name: input.name,
              timezone: input.timezone,
              isActive: true,
            });
            await recordAudit(
              auditRepository,
              access,
              correlationId,
              entityType,
              created.id,
              created.id,
              toAuditMetadata(input),
              intent,
            );
          } else {
            if (!id) throw new ConfigurationMutationError("invalid", entityType);
            const existing = await repository.findProperty(id, access.organizationId);
            if (!existing) throw new ConfigurationMutationError("not_found", entityType, id);
            await repository.updateProperty(id, access.organizationId, input);
            await recordAudit(
              auditRepository,
              access,
              correlationId,
              entityType,
              id,
              id,
              toAuditMetadata(input),
              intent,
            );
          }
        } catch (error) {
          friendlyDatabaseError(error, entityType, id);
        }
        return { entityType, intent };
      }

      case "building_area": {
        const input =
          intent === "deactivate"
            ? null
            : parseOrThrow(
                buildingAreaSchema.safeParse({
          code: formData.get("code"),
          name: formData.get("name"),
          propertyId: formData.get("propertyId"),
          kind: formData.get("kind"),
                }),
                entityType,
                id,
              );

        const propertyId = input?.propertyId;
        requireManageAccess(access, entityType, propertyId);
        if (intent === "deactivate") {
          if (!id) throw new ConfigurationMutationError("invalid", entityType);
          const current = await repository.findBuildingArea(id, access.organizationId);
          if (!current) throw new ConfigurationMutationError("not_found", entityType, id);
          requireManageAccess(access, entityType, current.propertyId);
          if (await repository.countActiveBuildingAreaDependents(id, access.organizationId))
            throw new ConfigurationMutationError("linked", entityType, id);
          if (current.isActive) {
            await repository.updateBuildingArea(id, access.organizationId, { isActive: false });
            await recordAudit(auditRepository, access, correlationId, entityType, id, current.propertyId, { code: current.code, name: current.name }, intent);
          }
          return { entityType, intent };
        }

        const property = await repository.findProperty(input.propertyId, access.organizationId);
        if (!property?.isActive) throw new ConfigurationMutationError("invalid", entityType, id);
        const duplicate = await repository.findActiveBuildingAreaByCodeOrName(
          input.propertyId,
          access.organizationId,
          input.code,
          input.name,
          intent === "update" ? id : undefined,
        );
        if (duplicate) throw new ConfigurationMutationError("duplicate", entityType, id);
        try {
          if (intent === "create") {
            const created = await repository.createBuildingArea({
              organizationId: access.organizationId,
              propertyId: input.propertyId,
              code: input.code,
              name: input.name,
              kind: input.kind,
              isActive: true,
            });
            await recordAudit(
              auditRepository,
              access,
              correlationId,
              entityType,
              created.id,
              input.propertyId,
              toAuditMetadata(input),
              intent,
            );
          } else {
            if (!id) throw new ConfigurationMutationError("invalid", entityType);
            const existing = await repository.findBuildingArea(id, access.organizationId);
            if (!existing) throw new ConfigurationMutationError("not_found", entityType, id);
            await repository.updateBuildingArea(id, access.organizationId, input);
            await recordAudit(
              auditRepository,
              access,
              correlationId,
              entityType,
              id,
              input.propertyId,
              toAuditMetadata(input),
              intent,
            );
          }
        } catch (error) {
          friendlyDatabaseError(error, entityType, id);
        }
        return { entityType, intent };
      }

      case "service_location": {
        const input =
          intent === "deactivate"
            ? null
            : parseOrThrow(
                serviceLocationSchema.safeParse({
          code: formData.get("code"),
          name: formData.get("name"),
          propertyId: formData.get("propertyId"),
          buildingAreaId: formData.get("buildingAreaId"),
          kind: formData.get("kind"),
                }),
                entityType,
                id,
              );
        const propertyId = input?.propertyId;
        requireManageAccess(access, entityType, propertyId);
        if (intent === "deactivate") {
          if (!id) throw new ConfigurationMutationError("invalid", entityType);
          const current = await repository.findServiceLocation(id, access.organizationId);
          if (!current) throw new ConfigurationMutationError("not_found", entityType, id);
          requireManageAccess(access, entityType, current.propertyId);
          if (current.isActive) {
            await repository.updateServiceLocation(id, access.organizationId, { isActive: false });
            await recordAudit(auditRepository, access, correlationId, entityType, id, current.propertyId, { code: current.code, name: current.name }, intent);
          }
          return { entityType, intent };
        }

        const [property, buildingArea] = await Promise.all([
          repository.findProperty(input.propertyId, access.organizationId),
          repository.findBuildingArea(input.buildingAreaId, access.organizationId),
        ]);
        if (!property?.isActive || !buildingArea?.isActive || buildingArea.propertyId !== input.propertyId)
          throw new ConfigurationMutationError("invalid", entityType, id);
        const duplicate = await repository.findActiveServiceLocationByCodeOrName(
          input.buildingAreaId,
          access.organizationId,
          input.code,
          input.name,
          intent === "update" ? id : undefined,
        );
        if (duplicate) throw new ConfigurationMutationError("duplicate", entityType, id);
        try {
          if (intent === "create") {
            const created = await repository.createServiceLocation({
              organizationId: access.organizationId,
              propertyId: input.propertyId,
              buildingAreaId: input.buildingAreaId,
              code: input.code,
              name: input.name,
              kind: input.kind,
              isActive: true,
            });
            await recordAudit(
              auditRepository,
              access,
              correlationId,
              entityType,
              created.id,
              input.propertyId,
              toAuditMetadata(input),
              intent,
            );
          } else {
            if (!id) throw new ConfigurationMutationError("invalid", entityType);
            const existing = await repository.findServiceLocation(id, access.organizationId);
            if (!existing) throw new ConfigurationMutationError("not_found", entityType, id);
            await repository.updateServiceLocation(id, access.organizationId, input);
            await recordAudit(
              auditRepository,
              access,
              correlationId,
              entityType,
              id,
              input.propertyId,
              toAuditMetadata(input),
              intent,
            );
          }
        } catch (error) {
          friendlyDatabaseError(error, entityType, id);
        }
        return { entityType, intent };
      }

      case "department": {
        const input =
          intent === "deactivate"
            ? null
            : parseOrThrow(
                departmentSchema.safeParse({
          code: formData.get("code"),
          name: formData.get("name"),
          propertyId: formData.get("propertyId"),
                }),
                entityType,
                id,
              );
        const propertyId = input?.propertyId;
        requireManageAccess(access, entityType, propertyId);
        if (intent === "deactivate") {
          if (!id) throw new ConfigurationMutationError("invalid", entityType);
          const current = await repository.findDepartment(id, access.organizationId);
          if (!current) throw new ConfigurationMutationError("not_found", entityType, id);
          requireManageAccess(access, entityType, current.propertyId);
          if (await repository.countActiveDepartmentDependents(id, access.organizationId))
            throw new ConfigurationMutationError("linked", entityType, id);
          if (current.isActive) {
            await repository.updateDepartment(id, access.organizationId, { isActive: false });
            await recordAudit(auditRepository, access, correlationId, entityType, id, current.propertyId, { code: current.code, name: current.name }, intent);
          }
          return { entityType, intent };
        }

        const property = await repository.findProperty(input.propertyId, access.organizationId);
        if (!property?.isActive) throw new ConfigurationMutationError("invalid", entityType, id);
        const duplicate = await repository.findActiveDepartmentByCodeOrName(
          input.propertyId,
          access.organizationId,
          input.code,
          input.name,
          intent === "update" ? id : undefined,
        );
        if (duplicate) throw new ConfigurationMutationError("duplicate", entityType, id);
        try {
          if (intent === "create") {
            const created = await repository.createDepartment({
              organizationId: access.organizationId,
              propertyId: input.propertyId,
              code: input.code,
              name: input.name,
              isActive: true,
            });
            await recordAudit(
              auditRepository,
              access,
              correlationId,
              entityType,
              created.id,
              input.propertyId,
              toAuditMetadata(input),
              intent,
            );
          } else {
            if (!id) throw new ConfigurationMutationError("invalid", entityType);
            const existing = await repository.findDepartment(id, access.organizationId);
            if (!existing) throw new ConfigurationMutationError("not_found", entityType, id);
            await repository.updateDepartment(id, access.organizationId, input);
            await recordAudit(
              auditRepository,
              access,
              correlationId,
              entityType,
              id,
              input.propertyId,
              toAuditMetadata(input),
              intent,
            );
          }
        } catch (error) {
          friendlyDatabaseError(error, entityType, id);
        }
        return { entityType, intent };
      }

      case "support_team": {
        const input =
          intent === "deactivate"
            ? null
            : parseOrThrow(
                supportTeamSchema.safeParse({
          code: formData.get("code"),
          name: formData.get("name"),
          propertyId: formData.get("propertyId"),
          departmentId: formData.get("departmentId"),
                }),
                entityType,
                id,
              );
        const propertyId = input?.propertyId;
        requireManageAccess(access, entityType, propertyId);
        if (intent === "deactivate") {
          if (!id) throw new ConfigurationMutationError("invalid", entityType);
          const current = await repository.findSupportTeam(id, access.organizationId);
          if (!current) throw new ConfigurationMutationError("not_found", entityType, id);
          requireManageAccess(access, entityType, current.propertyId);
          if (current.isActive) {
            await repository.updateSupportTeam(id, access.organizationId, { isActive: false });
            await recordAudit(auditRepository, access, correlationId, entityType, id, current.propertyId, { code: current.code, name: current.name }, intent);
          }
          return { entityType, intent };
        }

        const property = await repository.findProperty(input.propertyId, access.organizationId);
        if (!property?.isActive) throw new ConfigurationMutationError("invalid", entityType, id);
        if (input.departmentId) {
          const department = await repository.findDepartment(input.departmentId, access.organizationId);
          if (!department?.isActive || department.propertyId !== input.propertyId)
            throw new ConfigurationMutationError("invalid", entityType, id);
        }
        const duplicate = await repository.findActiveSupportTeamByCodeOrName(
          input.propertyId,
          access.organizationId,
          input.code,
          input.name,
          intent === "update" ? id : undefined,
        );
        if (duplicate) throw new ConfigurationMutationError("duplicate", entityType, id);
        try {
          if (intent === "create") {
            const created = await repository.createSupportTeam({
              organizationId: access.organizationId,
              propertyId: input.propertyId,
              departmentId: input.departmentId,
              code: input.code,
              name: input.name,
              isActive: true,
            });
            await recordAudit(
              auditRepository,
              access,
              correlationId,
              entityType,
              created.id,
              input.propertyId,
              toAuditMetadata(input),
              intent,
            );
          } else {
            if (!id) throw new ConfigurationMutationError("invalid", entityType);
            const existing = await repository.findSupportTeam(id, access.organizationId);
            if (!existing) throw new ConfigurationMutationError("not_found", entityType, id);
            await repository.updateSupportTeam(id, access.organizationId, input);
            await recordAudit(
              auditRepository,
              access,
              correlationId,
              entityType,
              id,
              input.propertyId,
              toAuditMetadata(input),
              intent,
            );
          }
        } catch (error) {
          friendlyDatabaseError(error, entityType, id);
        }
        return { entityType, intent };
      }

      case "ticket_category": {
        requireManageAccess(access, entityType);
        if (intent === "deactivate") {
          if (!id) throw new ConfigurationMutationError("invalid", entityType);
          const current = await repository.findTicketCategory(id, access.organizationId);
          if (!current) throw new ConfigurationMutationError("not_found", entityType, id);
          if (await repository.countActiveCategoryDependents(id, access.organizationId))
            throw new ConfigurationMutationError("linked", entityType, id);
          if (current.isActive) {
            await repository.updateTicketCategory(id, access.organizationId, { isActive: false });
            await recordAudit(auditRepository, access, correlationId, entityType, id, null, { code: current.code, name: current.name }, intent);
          }
          return { entityType, intent };
        }

        const input = parseOrThrow(
          ticketCategorySchema.safeParse({
          code: formData.get("code"),
          name: formData.get("name"),
          }),
          entityType,
          id,
        );
        const duplicate = await repository.findActiveTicketCategoryByCodeOrName(
          access.organizationId,
          input.code,
          input.name,
          intent === "update" ? id : undefined,
        );
        if (duplicate) throw new ConfigurationMutationError("duplicate", entityType, id);
        try {
          if (intent === "create") {
            const created = await repository.createTicketCategory({
              organizationId: access.organizationId,
              code: input.code,
              name: input.name,
              isActive: true,
            });
            await recordAudit(
              auditRepository,
              access,
              correlationId,
              entityType,
              created.id,
              null,
              toAuditMetadata(input),
              intent,
            );
          } else {
            if (!id) throw new ConfigurationMutationError("invalid", entityType);
            const existing = await repository.findTicketCategory(id, access.organizationId);
            if (!existing) throw new ConfigurationMutationError("not_found", entityType, id);
            await repository.updateTicketCategory(id, access.organizationId, input);
            await recordAudit(
              auditRepository,
              access,
              correlationId,
              entityType,
              id,
              null,
              toAuditMetadata(input),
              intent,
            );
          }
        } catch (error) {
          friendlyDatabaseError(error, entityType, id);
        }
        return { entityType, intent };
      }

      case "ticket_subcategory": {
        requireManageAccess(access, entityType);
        if (intent === "deactivate") {
          if (!id) throw new ConfigurationMutationError("invalid", entityType);
          const current = await repository.findTicketSubcategory(id, access.organizationId);
          if (!current) throw new ConfigurationMutationError("not_found", entityType, id);
          if (current.isActive) {
            await repository.updateTicketSubcategory(id, access.organizationId, { isActive: false });
            await recordAudit(auditRepository, access, correlationId, entityType, id, null, { code: current.code, name: current.name }, intent);
          }
          return { entityType, intent };
        }

        const input = parseOrThrow(
          ticketSubcategorySchema.safeParse({
          code: formData.get("code"),
          name: formData.get("name"),
          categoryId: formData.get("categoryId"),
          }),
          entityType,
          id,
        );
        const category = await repository.findTicketCategory(input.categoryId, access.organizationId);
        if (!category?.isActive) throw new ConfigurationMutationError("invalid", entityType, id);
        const duplicate = await repository.findActiveTicketSubcategoryByCodeOrName(
          input.categoryId,
          access.organizationId,
          input.code,
          input.name,
          intent === "update" ? id : undefined,
        );
        if (duplicate) throw new ConfigurationMutationError("duplicate", entityType, id);
        try {
          if (intent === "create") {
            const created = await repository.createTicketSubcategory({
              organizationId: access.organizationId,
              categoryId: input.categoryId,
              code: input.code,
              name: input.name,
              isActive: true,
            });
            await recordAudit(
              auditRepository,
              access,
              correlationId,
              entityType,
              created.id,
              null,
              toAuditMetadata(input),
              intent,
            );
          } else {
            if (!id) throw new ConfigurationMutationError("invalid", entityType);
            const existing = await repository.findTicketSubcategory(id, access.organizationId);
            if (!existing) throw new ConfigurationMutationError("not_found", entityType, id);
            await repository.updateTicketSubcategory(id, access.organizationId, input);
            await recordAudit(
              auditRepository,
              access,
              correlationId,
              entityType,
              id,
              null,
              toAuditMetadata(input),
              intent,
            );
          }
        } catch (error) {
          friendlyDatabaseError(error, entityType, id);
        }
        return { entityType, intent };
      }
    }
  });
}
