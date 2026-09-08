import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  articleFindMany: vi.fn(),
  articleFindFirst: vi.fn(),
  transaction: vi.fn(),
}));

const tx = {
  knowledgeArticle: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  knowledgeArticleVersion: { create: vi.fn() },
  knowledgeArticleAsset: { create: vi.fn(), deleteMany: vi.fn() },
  knowledgeFeedback: { upsert: vi.fn() },
  knowledgeTicketLink: { upsert: vi.fn() },
  ticketCategory: { findFirst: vi.fn() },
  user: { findFirst: vi.fn() },
  asset: { findFirst: vi.fn() },
  ticket: { findFirst: vi.fn() },
  ticketActivity: { create: vi.fn() },
  auditEvent: { create: vi.fn() },
};

vi.mock("@/server/database/client", () => ({
  database: {
    knowledgeArticle: { findMany: mocks.articleFindMany, findFirst: mocks.articleFindFirst },
    ticketCategory: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    asset: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: mocks.transaction,
  },
}));

import type { AccessProfile } from "@/server/auth/access";
import { KnowledgeError } from "@/server/knowledge/policy";
import {
  createKnowledgeArticle,
  getKnowledgeArticle,
  linkKnowledgeToTicket,
  searchKnowledge,
  transitionKnowledgeArticle,
  updateKnowledgeArticle,
} from "@/server/knowledge/service";

const ids = {
  organization: "11111111-1111-4111-8111-111111111111",
  property: "22222222-2222-4222-8222-222222222222",
  requester: "33333333-3333-4333-8333-333333333333",
  technician: "44444444-4444-4444-8444-444444444444",
  manager: "55555555-5555-4555-8555-555555555555",
  article: "66666666-6666-4666-8666-666666666666",
  reviewer: "77777777-7777-4777-8777-777777777777",
  correlation: "88888888-8888-4888-8888-888888888888",
};

function access(role: AccessProfile["roles"][number]): AccessProfile {
  const userId =
    role === "requester" ? ids.requester : role === "technician" ? ids.technician : ids.manager;
  return {
    userId,
    authUserId: "99999999-9999-4999-8999-999999999999",
    email: `${role}@example.invalid`,
    displayName: role,
    organizationId: ids.organization,
    organizationName: "Peter Island Resort and Spa",
    properties: [{ id: ids.property, name: "Peter Island" }],
    departmentIds: [],
    roles: [role],
    roleAssignments: [{ propertyId: ids.property, role }],
    assuranceLevel: "aal1",
    mustChangePassword: false,
  };
}

const article = {
  id: ids.article,
  organizationId: ids.organization,
  title: "Reconnect the reception printer",
  summary: "Restore printing after the front desk device loses its queue.",
  body: "## Check the queue\n\nRestart the approved print service.",
  audience: "technician",
  state: "published",
  categoryId: null,
  ownerUserId: ids.technician,
  reviewerUserId: ids.reviewer,
  currentVersion: 2,
  reviewDate: new Date("2026-12-01T00:00:00.000Z"),
  owner: { id: ids.technician, displayName: "Technician" },
  reviewer: { id: ids.reviewer, displayName: "Manager" },
  category: null,
  versions: [],
  assetLinks: [],
  feedback: [],
};

describe("knowledge service audience and workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callback) => callback(tx));
    mocks.articleFindMany.mockResolvedValue([]);
  });

  it("hard-filters staff search to published staff articles even when a state is supplied", async () => {
    await searchKnowledge(access("requester"), { query: "printer", state: "retired" });
    expect(mocks.articleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ids.organization,
          AND: expect.arrayContaining([{ state: "published", audience: "staff" }]),
        }),
      }),
    );
  });

  it("does not reveal technician-only content through a known direct URL", async () => {
    mocks.articleFindFirst.mockResolvedValue(article);
    await expect(getKnowledgeArticle(access("requester"), ids.article)).rejects.toEqual(
      new KnowledgeError("not_found"),
    );
    expect(mocks.articleFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: ids.article,
          organizationId: ids.organization,
          AND: [{ state: "published", audience: "staff" }],
        },
      }),
    );
  });

  it("allows a technician to read the same published technician article", async () => {
    mocks.articleFindFirst.mockResolvedValue(article);
    await expect(getKnowledgeArticle(access("technician"), ids.article)).resolves.toEqual(
      expect.objectContaining({ id: ids.article, audience: "technician" }),
    );
  });

  it("does not disclose asset inventory or editorial history with a staff article", async () => {
    mocks.articleFindFirst.mockResolvedValue({
      ...article,
      audience: "staff",
      versions: [
        {
          id: "version",
          version: 1,
          changeSummary: "Internal edit",
          createdAt: new Date(),
          createdBy: { displayName: "Technician" },
        },
      ],
      assetLinks: [
        { asset: { id: ids.article, assetTag: "PRIVATE-ASSET", name: "Private device" } },
      ],
    });
    const result = await getKnowledgeArticle(access("requester"), ids.article);
    expect(result.versions).toEqual([]);
    expect(result.assetLinks).toEqual([]);
  });

  it("builds technician search from published staff and technician audiences", async () => {
    await searchKnowledge(access("technician"), {});
    expect(mocks.articleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { state: "published", audience: { in: ["staff", "technician"] } },
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  it("denies article creation to requesters before opening a transaction", async () => {
    await expect(createKnowledgeArticle(access("requester"), {}, ids.correlation)).rejects.toEqual(
      new KnowledgeError("denied"),
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates a new immutable version and detects optimistic conflicts", async () => {
    tx.knowledgeArticle.findFirst.mockResolvedValue({
      id: ids.article,
      ownerUserId: ids.technician,
      state: "draft",
      currentVersion: 2,
    });
    tx.knowledgeArticle.updateMany.mockResolvedValue({ count: 1 });
    await updateKnowledgeArticle(
      access("technician"),
      {
        articleId: ids.article,
        title: article.title,
        summary: article.summary,
        body: article.body,
        audience: "technician",
        changeSummary: "Clarified the restart sequence",
        expectedVersion: 2,
      },
      ids.correlation,
    );
    expect(tx.knowledgeArticleVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        articleId: ids.article,
        version: 3,
        changeSummary: "Clarified the restart sequence",
      }),
    });
    tx.knowledgeArticle.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      updateKnowledgeArticle(
        access("technician"),
        {
          articleId: ids.article,
          title: article.title,
          summary: article.summary,
          body: article.body,
          audience: "technician",
          changeSummary: "Another revision",
          expectedVersion: 2,
        },
        ids.correlation,
      ),
    ).rejects.toEqual(new KnowledgeError("conflict"));
  });

  it("requires publishing authority and an independent reviewer before publication", async () => {
    tx.knowledgeArticle.findFirst.mockResolvedValue({
      id: ids.article,
      state: "in_review",
      ownerUserId: ids.technician,
      reviewerUserId: null,
      reviewDate: null,
      currentVersion: 2,
    });
    await expect(
      transitionKnowledgeArticle(
        access("technician"),
        { articleId: ids.article, toState: "published", expectedVersion: 2 },
        ids.correlation,
      ),
    ).rejects.toEqual(new KnowledgeError("denied"));
    await expect(
      transitionKnowledgeArticle(
        access("it_manager"),
        { articleId: ids.article, toState: "published", expectedVersion: 2 },
        ids.correlation,
      ),
    ).rejects.toEqual(new KnowledgeError("workflow"));
  });

  it("creates a resolution proposal only from manually supplied article text", async () => {
    tx.ticket.findFirst.mockResolvedValue({
      id: ids.article,
      propertyId: ids.property,
      status: "resolved",
    });
    tx.knowledgeArticle.create.mockResolvedValue({ id: ids.article });
    await createKnowledgeArticle(
      access("technician"),
      {
        title: "Reconnect a shared printer",
        summary: "Reusable printer reconnection steps for resort workstations.",
        body: "Open the approved queue and reconnect the shared printer.",
        audience: "staff",
        changeSummary: "Proposed after a completed repair",
        sourceTicketId: ids.article,
      },
      ids.correlation,
    );
    expect(tx.ticket.findFirst).toHaveBeenCalledWith({
      where: { id: ids.article, organizationId: ids.organization },
      select: { id: true, propertyId: true, status: true },
    });
    expect(tx.knowledgeArticle.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Reconnect a shared printer",
        body: "Open the approved queue and reconnect the shared printer.",
        sourceTicketId: ids.article,
      }),
    });
  });

  it("links only an authorized published article and keeps technician guidance internal", async () => {
    tx.knowledgeArticle.findFirst.mockResolvedValue(article);
    tx.ticket.findFirst.mockResolvedValue({ id: ids.article, propertyId: ids.property });
    tx.knowledgeTicketLink.upsert.mockResolvedValue({ id: "link-id" });
    await linkKnowledgeToTicket(
      access("technician"),
      { articleId: ids.article, ticketId: ids.article },
      ids.correlation,
    );
    expect(tx.ticketActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activityType: "knowledge_linked",
        requesterVisible: false,
      }),
    });
  });
});
