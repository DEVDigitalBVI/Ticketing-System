import "dotenv/config";

import { createDatabaseClient } from "../src/server/database/factory";
import { AuditEventRepository } from "../src/server/repositories/audit-event-repository";
import { IdentityRepository } from "../src/server/repositories/identity-repository";
import { OrganizationRepository } from "../src/server/repositories/organization-repository";

const connectionString = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Seed configuration is incomplete: set DATABASE_DIRECT_URL or DATABASE_URL.");
}

const client = createDatabaseClient(connectionString);

try {
  await client.$transaction(async (transaction) => {
    const organizations = new OrganizationRepository(transaction);
    const identities = new IdentityRepository(transaction);
    const auditEvents = new AuditEventRepository(transaction);

    const organization = await organizations.upsert({
      slug: "northstar-hospitality",
      name: "Northstar Hospitality Collective",
    });

    const cayProperty = await organizations.upsertProperty({
      organizationId: organization.id,
      code: "seabreeze_cay",
      name: "Seabreeze Cay Resort",
      timezone: "America/Tortola",
      isActive: true,
    });
    const harbourProperty = await organizations.upsertProperty({
      organizationId: organization.id,
      code: "harbour_lantern",
      name: "Harbour Lantern Hotel",
      timezone: "America/Tortola",
      isActive: true,
    });

    await Promise.all([
      organizations.upsertDepartment({
        organizationId: organization.id,
        propertyId: cayProperty.id,
        code: "front_office",
        name: "Front Office",
        isActive: true,
      }),
      organizations.upsertDepartment({
        organizationId: organization.id,
        propertyId: cayProperty.id,
        code: "culinary",
        name: "Culinary",
        isActive: true,
      }),
      organizations.upsertDepartment({
        organizationId: organization.id,
        propertyId: harbourProperty.id,
        code: "guest_services",
        name: "Guest Services",
        isActive: true,
      }),
    ]);

    const [staffRole, technicianRole, administratorRole] = await Promise.all([
      identities.upsertRole({
        organizationId: organization.id,
        key: "staff",
        name: "Staff",
        description: "May request and follow support for an assigned property.",
      }),
      identities.upsertRole({
        organizationId: organization.id,
        key: "technician",
        name: "Technician",
        description: "May triage and work service requests for an assigned property.",
      }),
      identities.upsertRole({
        organizationId: organization.id,
        key: "it_administrator",
        name: "IT administrator",
        description: "May administer service desk access for an assigned property.",
      }),
    ]);

    const [staffUser, technicianUser, administratorUser] = await Promise.all([
      identities.upsertUser({
        organizationId: organization.id,
        email: "avery.morgan@example.test",
        displayName: "Avery Morgan",
        isActive: true,
      }),
      identities.upsertUser({
        organizationId: organization.id,
        email: "devon.lee@example.test",
        displayName: "Devon Lee",
        isActive: true,
      }),
      identities.upsertUser({
        organizationId: organization.id,
        email: "kai.bennett@example.test",
        displayName: "Kai Bennett",
        isActive: true,
      }),
    ]);

    await Promise.all([
      identities.assignRole({
        organizationId: organization.id,
        userId: staffUser.id,
        roleId: staffRole.id,
        propertyId: cayProperty.id,
      }),
      identities.assignRole({
        organizationId: organization.id,
        userId: technicianUser.id,
        roleId: technicianRole.id,
        propertyId: cayProperty.id,
      }),
      identities.assignRole({
        organizationId: organization.id,
        userId: administratorUser.id,
        roleId: administratorRole.id,
        propertyId: cayProperty.id,
      }),
    ]);

    await auditEvents.recordOnce({
      id: "0198f3a5-b401-7d31-a884-a579e21ebae7",
      organizationId: organization.id,
      propertyId: cayProperty.id,
      actorUserId: administratorUser.id,
      action: "development_seed_completed",
      entityType: "organization",
      entityId: organization.id,
      metadata: { source: "fictional-development-seed" },
    });
  });
} finally {
  await client.$disconnect();
}
