import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@/server/database/factory";

const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL is required for database tests.");
const client = createDatabaseClient(connectionString);

const ids = {
  organization: "18b8d97e-9622-4ca7-b344-6230ad863e84",
  owner: "9a132265-9330-4886-8a5a-83820cc7fb31",
  reviewer: "a342434a-caa4-461c-8b0a-b3c08f09df51",
};

beforeAll(async () => {
  await client.$connect();
  await Promise.all([
    client.user.upsert({
      where: { id: ids.owner },
      create: {
        id: ids.owner,
        organizationId: ids.organization,
        email: "knowledge-owner@example.invalid",
        displayName: "Knowledge Owner",
        mustChangePassword: false,
      },
      update: {},
    }),
    client.user.upsert({
      where: { id: ids.reviewer },
      create: {
        id: ids.reviewer,
        organizationId: ids.organization,
        email: "knowledge-reviewer@example.invalid",
        displayName: "Knowledge Reviewer",
        mustChangePassword: false,
      },
      update: {},
    }),
  ]);
});

afterAll(async () => client.$disconnect());

describe("Step 26 knowledge base storage", () => {
  it("enforces publication metadata and immutable version history", async () => {
    await expect(
      client.knowledgeArticle.create({
        data: {
          organizationId: ids.organization,
          title: "Invalid publication",
          summary: "This publication is missing its reviewer.",
          body: "This body is deliberately long enough for validation.",
          audience: "staff",
          state: "published",
          ownerUserId: ids.owner,
          currentVersion: 1,
        },
      }),
    ).rejects.toBeTruthy();

    const article = await client.knowledgeArticle.create({
      data: {
        organizationId: ids.organization,
        title: "Reconnect a shared printer",
        summary: "Reviewed steps for reconnecting a resort shared printer.",
        body: "Open the approved printer queue and reconnect the shared device.",
        audience: "staff",
        state: "published",
        ownerUserId: ids.owner,
        reviewerUserId: ids.reviewer,
        currentVersion: 1,
        reviewDate: new Date("2027-01-01T00:00:00.000Z"),
        publishedAt: new Date(),
      },
    });
    const version = await client.knowledgeArticleVersion.create({
      data: {
        organizationId: ids.organization,
        articleId: article.id,
        version: 1,
        title: article.title,
        summary: article.summary,
        body: article.body,
        audience: article.audience,
        changeSummary: "Initial reviewed publication",
        createdByUserId: ids.owner,
      },
    });
    await expect(
      client.knowledgeArticleVersion.update({
        where: { id: version.id },
        data: { changeSummary: "Rewritten history" },
      }),
    ).rejects.toBeTruthy();
  });
});
