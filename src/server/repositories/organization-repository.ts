import type { Prisma } from "@/generated/prisma/client";
import type { DatabaseClient } from "@/server/database/types";

export class OrganizationRepository {
  constructor(private readonly client: DatabaseClient) {}

  findBySlug(slug: string) {
    return this.client.organization.findUnique({ where: { slug } });
  }

  upsert(data: Prisma.OrganizationCreateInput) {
    return this.client.organization.upsert({
      where: { slug: data.slug },
      create: data,
      update: { name: data.name },
    });
  }

  upsertProperty(data: Prisma.PropertyUncheckedCreateInput) {
    return this.client.property.upsert({
      where: {
        organizationId_code: {
          organizationId: data.organizationId,
          code: data.code,
        },
      },
      create: data,
      update: {
        isActive: data.isActive,
        name: data.name,
        timezone: data.timezone,
      },
    });
  }

  upsertDepartment(data: Prisma.DepartmentUncheckedCreateInput) {
    return this.client.department.upsert({
      where: {
        propertyId_code: {
          propertyId: data.propertyId,
          code: data.code,
        },
      },
      create: data,
      update: {
        isActive: data.isActive,
        name: data.name,
      },
    });
  }
}
