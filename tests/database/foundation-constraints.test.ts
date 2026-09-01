import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@/server/database/factory";

const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) throw new Error("TEST_DATABASE_URL is required for database tests.");

const client = createDatabaseClient(connectionString);

beforeAll(async () => {
  await client.$connect();
  const organization = await client.organization.create({
    data: { slug: "constraint-test-org", name: "Constraint Test Organisation" },
  });
  await client.property.createMany({
    data: [
      {
        organizationId: organization.id,
        code: "alpha_property",
        name: "Alpha Test Property",
        timezone: "America/Tortola",
      },
      {
        organizationId: organization.id,
        code: "beta_property",
        name: "Beta Test Property",
        timezone: "America/Tortola",
      },
    ],
  });
  const user = await client.user.create({
    data: {
      organizationId: organization.id,
      email: "database-test@example.invalid",
      displayName: "Database Test User",
    },
  });
  await client.role.create({
    data: {
      organizationId: organization.id,
      key: "test_role",
      name: "Test Role",
    },
  });
  await client.auditEvent.create({
    data: {
      organizationId: organization.id,
      actorUserId: user.id,
      action: "constraint_test_started",
      entityType: "test_run",
    },
  });
});

afterAll(async () => {
  await client.$disconnect();
});

describe("Step 4 database foundation", () => {
  it("supports one organisation with multiple properties", async () => {
    const organization = await client.organization.findUnique({
      where: { slug: "constraint-test-org" },
      include: { properties: true },
    });

    expect(organization?.name).toBe("Constraint Test Organisation");
    expect(organization?.properties).toHaveLength(2);
  });

  it("rejects duplicate property codes inside an organisation", async () => {
    const organization = await client.organization.findUniqueOrThrow({
      where: { slug: "constraint-test-org" },
    });

    await expect(
      client.property.create({
        data: {
          organizationId: organization.id,
          code: "alpha_property",
          name: "Duplicate Property Name",
          timezone: "America/Tortola",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("rejects role assignments that cross organisation boundaries", async () => {
    const firstOrganization = await client.organization.findUniqueOrThrow({
      where: { slug: "constraint-test-org" },
    });
    const secondOrganization = await client.organization.create({
      data: { slug: "wayfinder-lodging", name: "Wayfinder Lodging Group" },
    });
    const secondProperty = await client.property.create({
      data: {
        organizationId: secondOrganization.id,
        code: "driftwood_house",
        name: "Driftwood House",
        timezone: "America/Tortola",
      },
    });
    const user = await client.user.findFirstOrThrow({
      where: { organizationId: firstOrganization.id },
    });
    const role = await client.role.findFirstOrThrow({
      where: { organizationId: firstOrganization.id },
    });

    await expect(
      client.userRole.create({
        data: {
          organizationId: firstOrganization.id,
          propertyId: secondProperty.id,
          roleId: role.id,
          userId: user.id,
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("restricts deletion of an organisation that owns records", async () => {
    const organization = await client.organization.findUniqueOrThrow({
      where: { slug: "constraint-test-org" },
    });

    await expect(
      client.organization.delete({ where: { id: organization.id } }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("keeps audit events immutable", async () => {
    const event = await client.auditEvent.findFirstOrThrow({
      where: { action: "constraint_test_started" },
    });

    await expect(
      client.$executeRaw`update service_desk.audit_events set action = 'changed' where id = ${event.id}::uuid`,
    ).rejects.toBeTruthy();
    await expect(
      client.$executeRaw`delete from service_desk.audit_events where id = ${event.id}::uuid`,
    ).rejects.toBeTruthy();
  });

  it("requires a safe object for audit context", async () => {
    const organization = await client.organization.findUniqueOrThrow({
      where: { slug: "constraint-test-org" },
    });

    await expect(
      client.auditEvent.create({
        data: {
          organizationId: organization.id,
          action: "security.test",
          entityType: "test_run",
          result: "success",
          correlationId: crypto.randomUUID(),
          metadata: { nested: { access_token: "must-not-be-stored" } },
        },
      }),
    ).rejects.toBeTruthy();
  });

  it("rejects invalid audit results", async () => {
    const organization = await client.organization.findUniqueOrThrow({
      where: { slug: "constraint-test-org" },
    });
    await expect(
      client.$executeRaw`
        insert into service_desk.audit_events (
          organization_id, action, entity_type, result, request_correlation_id
        ) values (
          ${organization.id}::uuid, 'security.test', 'test_run', 'unknown', ${crypto.randomUUID()}::uuid
        )
      `,
    ).rejects.toBeTruthy();
  });

  it("updates timestamps for writes outside Prisma", async () => {
    const organization = await client.organization.findUniqueOrThrow({
      where: { slug: "constraint-test-org" },
    });
    const previousUpdatedAt = organization.updatedAt;

    await client.$executeRaw`
      update service_desk.organizations
      set name = name
      where id = ${organization.id}::uuid
    `;

    const updated = await client.organization.findUniqueOrThrow({ where: { id: organization.id } });
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(previousUpdatedAt.getTime());
  });
});
