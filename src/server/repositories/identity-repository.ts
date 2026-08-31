import type { Prisma } from "@/generated/prisma/client";
import type { DatabaseClient } from "@/server/database/types";

export class IdentityRepository {
  constructor(private readonly client: DatabaseClient) {}

  upsertUser(data: Prisma.UserUncheckedCreateInput) {
    return this.client.user.upsert({
      where: {
        organizationId_email: {
          organizationId: data.organizationId,
          email: data.email,
        },
      },
      create: data,
      update: {
        displayName: data.displayName,
        isActive: data.isActive,
      },
    });
  }

  upsertRole(data: Prisma.RoleUncheckedCreateInput) {
    return this.client.role.upsert({
      where: {
        organizationId_key: {
          organizationId: data.organizationId,
          key: data.key,
        },
      },
      create: data,
      update: {
        description: data.description,
        name: data.name,
      },
    });
  }

  assignRole(data: Prisma.UserRoleUncheckedCreateInput) {
    return this.client.userRole.upsert({
      where: {
        userId_roleId_propertyId: {
          userId: data.userId,
          roleId: data.roleId,
          propertyId: data.propertyId,
        },
      },
      create: data,
      update: {},
    });
  }
}
