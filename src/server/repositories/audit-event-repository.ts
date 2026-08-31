import type { Prisma } from "@/generated/prisma/client";
import type { DatabaseClient } from "@/server/database/types";

export class AuditEventRepository {
  constructor(private readonly client: DatabaseClient) {}

  record(data: Prisma.AuditEventUncheckedCreateInput) {
    return this.client.auditEvent.create({ data });
  }

  recordOnce(data: Prisma.AuditEventUncheckedCreateInput) {
    return this.client.auditEvent.createMany({ data, skipDuplicates: true });
  }

  listRecentForOrganization(organizationId: string, limit = 50) {
    return this.client.auditEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }
}
