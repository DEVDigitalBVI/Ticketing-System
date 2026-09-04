import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@/server/database/factory";
import { mutateConfiguration } from "@/server/configuration/service";
import type { AccessProfile } from "@/server/auth/access";

const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) throw new Error("TEST_DATABASE_URL is required for database tests.");

const client = createDatabaseClient(connectionString);

const ids = {
  organization: "18b8d97e-9622-4ca7-b344-6230ad863e84",
  property: "ab9c2f07-e909-4f9d-9092-49ad4e06df1f",
  adminUser: "4f8fa463-fda0-4f40-9256-a8dc6e1ca2c5",
  requesterUser: "f5e0445e-c273-4165-b739-f9f0f60dd638",
  auditCorrelation: "0c94c36a-24f7-4c6d-9928-7cfad8615c3a",
};

function access(role: AccessProfile["roles"][number]): AccessProfile {
  return {
    userId: role === "system_administrator" ? ids.adminUser : ids.requesterUser,
    authUserId: crypto.randomUUID(),
    email: role === "system_administrator" ? "admin@test.invalid" : "requester@test.invalid",
    displayName: role === "system_administrator" ? "Admin User" : "Requester User",
    organizationId: ids.organization,
    organizationName: "Peter Island Resort and Spa",
    properties: [{ id: ids.property, name: "Peter Island Resort and Spa" }],
    departmentIds: [],
    roles: [role],
    assuranceLevel: "aal2",
    mustChangePassword: false,
  };
}

async function submit(accessProfile: AccessProfile, values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return mutateConfiguration(accessProfile, form, ids.auditCorrelation);
}

beforeAll(async () => {
  await client.$connect();
  await client.user.createMany({
    data: [
      {
        id: ids.adminUser,
        organizationId: ids.organization,
        email: "admin@test.invalid",
        displayName: "Admin User",
        mustChangePassword: false,
      },
      {
        id: ids.requesterUser,
        organizationId: ids.organization,
        email: "requester@test.invalid",
        displayName: "Requester User",
        mustChangePassword: false,
      },
    ],
    skipDuplicates: true,
  });
});

afterAll(async () => {
  await client.$disconnect();
});

describe("Step 7 configuration management", () => {
  it("rejects configuration changes without administrator permission", async () => {
    await expect(
      submit(access("requester"), {
        intent: "create",
        entityType: "ticket_category",
        code: "security",
        name: "Security",
      }),
    ).rejects.toMatchObject({ code: "denied" });
  });

  it("validates property payloads before writing", async () => {
    await expect(
      submit(access("system_administrator"), {
        intent: "create",
        entityType: "property",
        code: "bad code",
        name: "Broken Property",
        timezone: "Mars/Phobos",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects hierarchy links that cross property boundaries", async () => {
    const otherProperty = await client.property.create({
      data: {
        organizationId: ids.organization,
        code: "north_point_annex",
        name: "North Point Annex",
        timezone: "America/Tortola",
      },
    });
    const otherArea = await client.buildingArea.create({
      data: {
        organizationId: ids.organization,
        propertyId: otherProperty.id,
        code: "annex_lobby",
        name: "Annex Lobby",
        kind: "area",
      },
    });

    await expect(
      submit(access("system_administrator"), {
        intent: "create",
        entityType: "service_location",
        propertyId: ids.property,
        buildingAreaId: otherArea.id,
        code: "bad_location_link",
        name: "Bad Location Link",
        kind: "service_location",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("prevents duplicate active values in the same scope", async () => {
    await expect(
      submit(access("system_administrator"), {
        intent: "create",
        entityType: "ticket_category",
        code: "accounts_and_access",
        name: "Accounts and Access",
      }),
    ).rejects.toMatchObject({ code: "duplicate" });
  });

  it("allows reuse after deactivation and records audit events for create, update, and deactivate", async () => {
    await submit(access("system_administrator"), {
      intent: "create",
      entityType: "ticket_category",
      code: "temporary_taxonomy",
      name: "Temporary Taxonomy",
    });

    const created = await client.ticketCategory.findFirstOrThrow({
      where: { organizationId: ids.organization, code: "temporary_taxonomy" },
    });

    await submit(access("system_administrator"), {
      intent: "update",
      entityType: "ticket_category",
      id: created.id,
      code: "temporary_taxonomy",
      name: "Temporary Taxonomy Updated",
    });

    await submit(access("system_administrator"), {
      intent: "deactivate",
      entityType: "ticket_category",
      id: created.id,
    });

    await submit(access("system_administrator"), {
      intent: "create",
      entityType: "ticket_category",
      code: "temporary_taxonomy",
      name: "Temporary Taxonomy Replacement",
    });

    const events = await client.auditEvent.findMany({
      where: {
        organizationId: ids.organization,
        entityType: "ticket_category",
        action: {
          in: [
            "configuration.ticket_category.created",
            "configuration.ticket_category.updated",
            "configuration.ticket_category.deactivated",
          ],
        },
      },
      orderBy: { createdAt: "asc" },
    });

    expect(events.map((event) => event.action)).toEqual([
      "configuration.ticket_category.created",
      "configuration.ticket_category.updated",
      "configuration.ticket_category.deactivated",
      "configuration.ticket_category.created",
    ]);
    expect(events.every((event) => event.actorUserId === ids.adminUser)).toBe(true);
  });

  it("blocks category deactivation while active subcategories exist", async () => {
    const category = await client.ticketCategory.create({
      data: {
        organizationId: ids.organization,
        code: "av_operations",
        name: "AV Operations",
      },
    });
    await client.ticketSubcategory.create({
      data: {
        organizationId: ids.organization,
        categoryId: category.id,
        code: "projector_alignment",
        name: "Projector Alignment",
      },
    });

    await expect(
      submit(access("system_administrator"), {
        intent: "deactivate",
        entityType: "ticket_category",
        id: category.id,
      }),
    ).rejects.toMatchObject({ code: "linked" });
  });
});
