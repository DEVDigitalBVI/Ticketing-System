import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@/server/database/factory";

const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL is required for database tests.");
const client = createDatabaseClient(connectionString);

beforeAll(async () => client.$connect());
afterAll(async () => client.$disconnect());

describe("Step 27 reporting facts", () => {
  it("captures labels once, follows deliberate ticket changes, and counts reopening", async () => {
    const property = await client.property.findFirstOrThrow();
    const category = await client.ticketCategory.findFirstOrThrow({
      where: { organizationId: property.organizationId },
    });
    const requester = await client.user.create({
      data: {
        organizationId: property.organizationId,
        email: `reporting-${crypto.randomUUID()}@example.invalid`,
        displayName: "Reporting Fixture",
        mustChangePassword: false,
      },
    });
    const ticket = await client.ticket.create({
      data: {
        organizationId: property.organizationId,
        ticketNumber: "generated-by-trigger",
        summary: "Reporting fact fixture",
        description: "Synthetic record used to verify historical reporting behavior.",
        requesterUserId: requester.id,
        propertyId: property.id,
        categoryId: category.id,
        impact: "low",
        urgency: "low",
        priority: "P4",
      },
    });
    const captured = await client.ticketReportingFact.findUniqueOrThrow({
      where: { ticketId: ticket.id },
    });
    expect(captured.categoryName).toBe(category.name);
    expect(captured.propertyName).toBe(property.name);

    await client.ticketCategory.update({
      where: { id: category.id },
      data: { name: `${category.name} renamed` },
    });
    expect(
      (await client.ticketReportingFact.findUniqueOrThrow({ where: { ticketId: ticket.id } }))
        .categoryName,
    ).toBe(category.name);

    await client.ticket.update({
      where: { id: ticket.id },
      data: {
        status: "resolved",
        resolutionCode: "fixed",
        resolutionSummary: "Synthetic resolution",
        resolvedAt: new Date(),
      },
    });
    await client.ticket.update({
      where: { id: ticket.id },
      data: {
        status: "triage",
        resolutionCode: null,
        resolutionSummary: null,
        resolvedAt: null,
      },
    });
    const reopened = await client.ticketReportingFact.findUniqueOrThrow({
      where: { ticketId: ticket.id },
    });
    expect(reopened.status).toBe("triage");
    expect(reopened.reopenCount).toBe(1);

    await client.ticketCategory.update({
      where: { id: category.id },
      data: { name: category.name },
    });
  });
});
