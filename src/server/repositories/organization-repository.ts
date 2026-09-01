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
    return this.client.property
      .findFirst({
        where: {
          organizationId: data.organizationId,
          code: data.code,
        },
      })
      .then((existing) =>
        existing
          ? this.client.property.update({
              where: {
                id_organizationId: { id: existing.id, organizationId: existing.organizationId },
              },
              data: {
                isActive: data.isActive,
                name: data.name,
                timezone: data.timezone,
              },
            })
          : this.client.property.create({ data }),
      );
  }

  upsertDepartment(data: Prisma.DepartmentUncheckedCreateInput) {
    return this.client.department
      .findFirst({
        where: {
          propertyId: data.propertyId,
          organizationId: data.organizationId,
          code: data.code,
        },
      })
      .then((existing) =>
        existing
          ? this.client.department.update({
              where: {
                id_organizationId: { id: existing.id, organizationId: existing.organizationId },
              },
              data: {
                isActive: data.isActive,
                name: data.name,
              },
            })
          : this.client.department.create({ data }),
      );
  }
}
