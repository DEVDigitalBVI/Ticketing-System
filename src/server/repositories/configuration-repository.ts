import type { Prisma } from "@/generated/prisma/client";
import type { DatabaseClient } from "@/server/database/types";

export class ConfigurationRepository {
  constructor(private readonly client: DatabaseClient) {}

  listProperties(organizationId: string) {
    return this.client.property.findMany({
      where: { organizationId },
      orderBy: [{ name: "asc" }],
    });
  }

  listBuildingAreas(organizationId: string) {
    return this.client.buildingArea.findMany({
      where: { organizationId },
      include: { property: { select: { name: true } } },
      orderBy: [{ property: { name: "asc" } }, { name: "asc" }],
    });
  }

  listServiceLocations(organizationId: string) {
    return this.client.serviceLocation.findMany({
      where: { organizationId },
      include: {
        property: { select: { name: true } },
        buildingArea: { select: { name: true, kind: true } },
      },
      orderBy: [{ property: { name: "asc" } }, { buildingArea: { name: "asc" } }, { name: "asc" }],
    });
  }

  listDepartments(organizationId: string) {
    return this.client.department.findMany({
      where: { organizationId },
      include: { property: { select: { name: true } } },
      orderBy: [{ property: { name: "asc" } }, { name: "asc" }],
    });
  }

  listSupportTeams(organizationId: string) {
    return this.client.supportTeam.findMany({
      where: { organizationId },
      include: {
        property: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: [{ property: { name: "asc" } }, { name: "asc" }],
    });
  }

  listTicketCategories(organizationId: string) {
    return this.client.ticketCategory.findMany({
      where: { organizationId },
      orderBy: [{ name: "asc" }],
    });
  }

  listTicketSubcategories(organizationId: string) {
    return this.client.ticketSubcategory.findMany({
      where: { organizationId },
      include: { category: { select: { name: true } } },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    });
  }

  findProperty(id: string, organizationId: string) {
    return this.client.property.findFirst({ where: { id, organizationId } });
  }

  findBuildingArea(id: string, organizationId: string) {
    return this.client.buildingArea.findFirst({
      where: { id, organizationId },
      include: { property: { select: { name: true } } },
    });
  }

  findServiceLocation(id: string, organizationId: string) {
    return this.client.serviceLocation.findFirst({
      where: { id, organizationId },
      include: {
        property: { select: { name: true } },
        buildingArea: { select: { name: true, kind: true } },
      },
    });
  }

  findDepartment(id: string, organizationId: string) {
    return this.client.department.findFirst({
      where: { id, organizationId },
      include: { property: { select: { name: true } } },
    });
  }

  findSupportTeam(id: string, organizationId: string) {
    return this.client.supportTeam.findFirst({
      where: { id, organizationId },
      include: {
        property: { select: { name: true } },
        department: { select: { name: true } },
      },
    });
  }

  findTicketCategory(id: string, organizationId: string) {
    return this.client.ticketCategory.findFirst({ where: { id, organizationId } });
  }

  findTicketSubcategory(id: string, organizationId: string) {
    return this.client.ticketSubcategory.findFirst({
      where: { id, organizationId },
      include: { category: { select: { name: true } } },
    });
  }

  createProperty(data: Prisma.PropertyUncheckedCreateInput) {
    return this.client.property.create({ data });
  }

  updateProperty(id: string, organizationId: string, data: Prisma.PropertyUncheckedUpdateInput) {
    return this.client.property.updateMany({
      where: { id, organizationId },
      data,
    });
  }

  createBuildingArea(data: Prisma.BuildingAreaUncheckedCreateInput) {
    return this.client.buildingArea.create({ data });
  }

  updateBuildingArea(
    id: string,
    organizationId: string,
    data: Prisma.BuildingAreaUncheckedUpdateInput,
  ) {
    return this.client.buildingArea.updateMany({
      where: { id, organizationId },
      data,
    });
  }

  createServiceLocation(data: Prisma.ServiceLocationUncheckedCreateInput) {
    return this.client.serviceLocation.create({ data });
  }

  updateServiceLocation(
    id: string,
    organizationId: string,
    data: Prisma.ServiceLocationUncheckedUpdateInput,
  ) {
    return this.client.serviceLocation.updateMany({
      where: { id, organizationId },
      data,
    });
  }

  createDepartment(data: Prisma.DepartmentUncheckedCreateInput) {
    return this.client.department.create({ data });
  }

  updateDepartment(id: string, organizationId: string, data: Prisma.DepartmentUncheckedUpdateInput) {
    return this.client.department.updateMany({
      where: { id, organizationId },
      data,
    });
  }

  createSupportTeam(data: Prisma.SupportTeamUncheckedCreateInput) {
    return this.client.supportTeam.create({ data });
  }

  updateSupportTeam(
    id: string,
    organizationId: string,
    data: Prisma.SupportTeamUncheckedUpdateInput,
  ) {
    return this.client.supportTeam.updateMany({
      where: { id, organizationId },
      data,
    });
  }

  createTicketCategory(data: Prisma.TicketCategoryUncheckedCreateInput) {
    return this.client.ticketCategory.create({ data });
  }

  updateTicketCategory(
    id: string,
    organizationId: string,
    data: Prisma.TicketCategoryUncheckedUpdateInput,
  ) {
    return this.client.ticketCategory.updateMany({
      where: { id, organizationId },
      data,
    });
  }

  createTicketSubcategory(data: Prisma.TicketSubcategoryUncheckedCreateInput) {
    return this.client.ticketSubcategory.create({ data });
  }

  updateTicketSubcategory(
    id: string,
    organizationId: string,
    data: Prisma.TicketSubcategoryUncheckedUpdateInput,
  ) {
    return this.client.ticketSubcategory.updateMany({
      where: { id, organizationId },
      data,
    });
  }

  countActivePropertyDependents(propertyId: string, organizationId: string) {
    return Promise.all([
      this.client.buildingArea.count({ where: { propertyId, organizationId, isActive: true } }),
      this.client.serviceLocation.count({ where: { propertyId, organizationId, isActive: true } }),
      this.client.department.count({ where: { propertyId, organizationId, isActive: true } }),
      this.client.supportTeam.count({ where: { propertyId, organizationId, isActive: true } }),
      this.client.userRole.count({ where: { propertyId, organizationId } }),
    ]);
  }

  countActiveBuildingAreaDependents(buildingAreaId: string, organizationId: string) {
    return this.client.serviceLocation.count({
      where: { buildingAreaId, organizationId, isActive: true },
    });
  }

  countActiveDepartmentDependents(departmentId: string, organizationId: string) {
    return this.client.supportTeam.count({
      where: { departmentId, organizationId, isActive: true },
    });
  }

  countActiveCategoryDependents(categoryId: string, organizationId: string) {
    return this.client.ticketSubcategory.count({
      where: { categoryId, organizationId, isActive: true },
    });
  }

  findActivePropertyByCodeOrName(
    organizationId: string,
    code: string,
    name: string,
    excludeId?: string,
  ) {
    return this.client.property.findFirst({
      where: {
        organizationId,
        isActive: true,
        id: excludeId ? { not: excludeId } : undefined,
        OR: [{ code }, { name: { equals: name, mode: "insensitive" } }],
      },
    });
  }

  findActiveBuildingAreaByCodeOrName(
    propertyId: string,
    organizationId: string,
    code: string,
    name: string,
    excludeId?: string,
  ) {
    return this.client.buildingArea.findFirst({
      where: {
        propertyId,
        organizationId,
        isActive: true,
        id: excludeId ? { not: excludeId } : undefined,
        OR: [{ code }, { name: { equals: name, mode: "insensitive" } }],
      },
    });
  }

  findActiveServiceLocationByCodeOrName(
    buildingAreaId: string,
    organizationId: string,
    code: string,
    name: string,
    excludeId?: string,
  ) {
    return this.client.serviceLocation.findFirst({
      where: {
        buildingAreaId,
        organizationId,
        isActive: true,
        id: excludeId ? { not: excludeId } : undefined,
        OR: [{ code }, { name: { equals: name, mode: "insensitive" } }],
      },
    });
  }

  findActiveDepartmentByCodeOrName(
    propertyId: string,
    organizationId: string,
    code: string,
    name: string,
    excludeId?: string,
  ) {
    return this.client.department.findFirst({
      where: {
        propertyId,
        organizationId,
        isActive: true,
        id: excludeId ? { not: excludeId } : undefined,
        OR: [{ code }, { name: { equals: name, mode: "insensitive" } }],
      },
    });
  }

  findActiveSupportTeamByCodeOrName(
    propertyId: string,
    organizationId: string,
    code: string,
    name: string,
    excludeId?: string,
  ) {
    return this.client.supportTeam.findFirst({
      where: {
        propertyId,
        organizationId,
        isActive: true,
        id: excludeId ? { not: excludeId } : undefined,
        OR: [{ code }, { name: { equals: name, mode: "insensitive" } }],
      },
    });
  }

  findActiveTicketCategoryByCodeOrName(
    organizationId: string,
    code: string,
    name: string,
    excludeId?: string,
  ) {
    return this.client.ticketCategory.findFirst({
      where: {
        organizationId,
        isActive: true,
        id: excludeId ? { not: excludeId } : undefined,
        OR: [{ code }, { name: { equals: name, mode: "insensitive" } }],
      },
    });
  }

  findActiveTicketSubcategoryByCodeOrName(
    categoryId: string,
    organizationId: string,
    code: string,
    name: string,
    excludeId?: string,
  ) {
    return this.client.ticketSubcategory.findFirst({
      where: {
        categoryId,
        organizationId,
        isActive: true,
        id: excludeId ? { not: excludeId } : undefined,
        OR: [{ code }, { name: { equals: name, mode: "insensitive" } }],
      },
    });
  }
}
