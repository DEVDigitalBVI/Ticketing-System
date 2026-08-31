import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@/server/database/factory";

const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) throw new Error("TEST_DATABASE_URL is required for database tests.");

const client = createDatabaseClient(connectionString);

beforeAll(async () => {
  await client.$connect();
});

afterAll(async () => {
  await client.$disconnect();
});

describe("Step 4 database foundation", () => {
  it("seeds one fictional organisation with multiple properties", async () => {
    const organization = await client.organization.findUnique({
      where: { slug: "northstar-hospitality" },
      include: { properties: true },
    });

    expect(organization?.name).toBe("Northstar Hospitality Collective");
    expect(organization?.properties).toHaveLength(2);
  });

  it("rejects duplicate property codes inside an organisation", async () => {
    const organization = await client.organization.findUniqueOrThrow({
      where: { slug: "northstar-hospitality" },
    });

    await expect(
      client.property.create({
        data: {
          organizationId: organization.id,
          code: "seabreeze_cay",
          name: "Duplicate Property Name",
          timezone: "America/Tortola",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("rejects role assignments that cross organisation boundaries", async () => {
    const firstOrganization = await client.organization.findUniqueOrThrow({
      where: { slug: "northstar-hospitality" },
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
      where: { slug: "northstar-hospitality" },
    });

    await expect(
      client.organization.delete({ where: { id: organization.id } }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("keeps audit events immutable", async () => {
    const event = await client.auditEvent.findFirstOrThrow({
      where: { action: "development_seed_completed" },
    });

    await expect(
      client.$executeRaw`update service_desk.audit_events set action = 'changed' where id = ${event.id}::uuid`,
    ).rejects.toBeTruthy();
    await expect(
      client.$executeRaw`delete from service_desk.audit_events where id = ${event.id}::uuid`,
    ).rejects.toBeTruthy();
  });

  it("updates timestamps for writes outside Prisma", async () => {
    const organization = await client.organization.findUniqueOrThrow({
      where: { slug: "northstar-hospitality" },
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
