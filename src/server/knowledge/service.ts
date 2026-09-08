import "server-only";

import { z } from "zod";

import { accessCan } from "@/server/auth/authorization";
import type { AccessProfile } from "@/server/auth/access";
import { database } from "@/server/database/client";
import {
  articleInputSchema,
  feedbackInputSchema,
  isStaleArticle,
  KnowledgeError,
  parseKnowledgeInput,
  searchInputSchema,
  ticketLinkInputSchema,
  transitionInputSchema,
  workflowTransitions,
  type KnowledgeState,
} from "@/server/knowledge/policy";

const articleInclude = {
  category: { select: { id: true, name: true } },
  owner: { select: { id: true, displayName: true } },
  reviewer: { select: { id: true, displayName: true } },
  versions: {
    select: {
      id: true,
      version: true,
      changeSummary: true,
      createdAt: true,
      createdBy: { select: { displayName: true } },
    },
    orderBy: { version: "desc" as const },
  },
  assetLinks: { select: { asset: { select: { id: true, assetTag: true, name: true } } } },
  feedback: { select: { helpful: true } },
};

function canRead(
  access: AccessProfile,
  article: { state: string; audience: string; ownerUserId: string; reviewerUserId: string | null },
) {
  if (!accessCan(access, "knowledge.read")) return false;
  if (article.state === "published")
    return article.audience === "staff" || accessCan(access, "knowledge.read.technician");
  return (
    accessCan(access, "knowledge.author") &&
    (article.ownerUserId === access.userId ||
      article.reviewerUserId === access.userId ||
      accessCan(access, "knowledge.publish"))
  );
}

function safeArticleView<T extends { reviewDate: Date | null; feedback: { helpful: boolean }[] }>(
  article: T,
  now = new Date(),
) {
  const helpful = article.feedback.filter((item) => item.helpful).length;
  return {
    ...article,
    stale: isStaleArticle(article.reviewDate, now),
    helpful,
    unhelpful: article.feedback.length - helpful,
  };
}

export async function searchKnowledge(access: AccessProfile, raw: unknown, now = new Date()) {
  if (!accessCan(access, "knowledge.read")) throw new KnowledgeError("denied");
  const input = parseKnowledgeInput(searchInputSchema.safeParse(raw));
  const canReadTechnician = accessCan(access, "knowledge.read.technician");
  const canAuthor = accessCan(access, "knowledge.author");
  const visibility = canReadTechnician
    ? {
        OR: [
          { state: "published", audience: { in: ["staff", "technician"] } },
          ...(canAuthor
            ? [
                { ownerUserId: access.userId, state: { not: "published" } },
                { reviewerUserId: access.userId, state: { not: "published" } },
                ...(accessCan(access, "knowledge.publish")
                  ? [{ state: { not: "published" } }]
                  : []),
              ]
            : []),
        ],
      }
    : { state: "published", audience: "staff" };
  const articles = await database.knowledgeArticle.findMany({
    where: {
      organizationId: access.organizationId,
      AND: [
        visibility,
        ...(input.query
          ? [
              {
                OR: ["title", "summary", "body"].map((field) => ({
                  [field]: { contains: input.query, mode: "insensitive" as const },
                })),
              },
            ]
          : []),
      ],
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(canAuthor && input.state ? { state: input.state } : {}),
      ...(canAuthor && input.stale ? { state: "published", reviewDate: { lt: now } } : {}),
    },
    select: {
      id: true,
      title: true,
      summary: true,
      audience: true,
      state: true,
      currentVersion: true,
      reviewDate: true,
      updatedAt: true,
      ownerUserId: true,
      reviewerUserId: true,
      category: { select: { id: true, name: true } },
      owner: { select: { displayName: true } },
      feedback: { select: { helpful: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
    take: 100,
  });
  return articles.map((article) => safeArticleView(article, now));
}

export async function getKnowledgeArticle(
  access: AccessProfile,
  articleId: string,
  now = new Date(),
) {
  if (!z.string().uuid().safeParse(articleId).success) throw new KnowledgeError("not_found");
  const visibility = accessCan(access, "knowledge.read.technician")
    ? {
        OR: [
          { state: "published", audience: { in: ["staff", "technician"] } },
          ...(accessCan(access, "knowledge.author")
            ? [
                { ownerUserId: access.userId, state: { not: "published" } },
                { reviewerUserId: access.userId, state: { not: "published" } },
                ...(accessCan(access, "knowledge.publish")
                  ? [{ state: { not: "published" } }]
                  : []),
              ]
            : []),
        ],
      }
    : { state: "published", audience: "staff" };
  const article = await database.knowledgeArticle.findFirst({
    where: { id: articleId, organizationId: access.organizationId, AND: [visibility] },
    include: articleInclude,
  });
  if (!article || !canRead(access, article)) throw new KnowledgeError("not_found");
  const canReadHistory =
    accessCan(access, "knowledge.author") &&
    (article.ownerUserId === access.userId ||
      article.reviewerUserId === access.userId ||
      accessCan(access, "knowledge.publish"));
  return safeArticleView(
    {
      ...article,
      versions: canReadHistory ? article.versions : [],
      assetLinks: accessCan(access, "asset.read") ? article.assetLinks : [],
    },
    now,
  );
}

export async function getKnowledgeOptions(access: AccessProfile) {
  if (!accessCan(access, "knowledge.read")) throw new KnowledgeError("denied");
  const [categories, reviewers, assets] = await Promise.all([
    database.ticketCategory.findMany({
      where: { organizationId: access.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    accessCan(access, "knowledge.author")
      ? database.user.findMany({
          where: {
            organizationId: access.organizationId,
            isActive: true,
            roles: { some: { role: { key: { in: ["it_manager", "system_administrator"] } } } },
          },
          select: { id: true, displayName: true },
          orderBy: { displayName: "asc" },
        })
      : Promise.resolve([]),
    accessCan(access, "knowledge.author")
      ? database.asset.findMany({
          where: { organizationId: access.organizationId, retiredAt: null },
          select: { id: true, assetTag: true, name: true },
          orderBy: { assetTag: "asc" },
          take: 250,
        })
      : Promise.resolve([]),
  ]);
  return { categories, reviewers, assets };
}

async function validateOptionalReferences(
  tx: Parameters<Parameters<typeof database.$transaction>[0]>[0],
  access: AccessProfile,
  input: {
    categoryId?: string;
    reviewerUserId?: string;
    assetId?: string;
    sourceTicketId?: string;
  },
) {
  if (
    input.categoryId &&
    !(await tx.ticketCategory.findFirst({
      where: { id: input.categoryId, organizationId: access.organizationId, isActive: true },
      select: { id: true },
    }))
  )
    throw new KnowledgeError("invalid");
  if (input.reviewerUserId) {
    const reviewer = await tx.user.findFirst({
      where: {
        id: input.reviewerUserId,
        organizationId: access.organizationId,
        isActive: true,
        roles: {
          some: { role: { key: { in: ["it_manager", "system_administrator"] } } },
        },
      },
      select: { id: true },
    });
    if (!reviewer || reviewer.id === access.userId) throw new KnowledgeError("invalid");
  }
  if (input.assetId) {
    const asset = await tx.asset.findFirst({
      where: { id: input.assetId, organizationId: access.organizationId, retiredAt: null },
      select: { id: true, propertyId: true },
    });
    if (
      !asset ||
      !accessCan(access, "asset.read", {
        organizationId: access.organizationId,
        propertyId: asset.propertyId,
      })
    )
      throw new KnowledgeError("invalid");
  }
  if (input.sourceTicketId) {
    if (!accessCan(access, "knowledge.link")) throw new KnowledgeError("denied");
    const ticket = await tx.ticket.findFirst({
      where: { id: input.sourceTicketId, organizationId: access.organizationId },
      select: { id: true, propertyId: true, status: true },
    });
    if (
      !ticket ||
      !["resolved", "closed"].includes(ticket.status) ||
      !accessCan(access, "ticket.queue.read", {
        organizationId: access.organizationId,
        propertyId: ticket.propertyId,
      })
    )
      throw new KnowledgeError("ticket");
  }
}

export async function createKnowledgeArticle(
  access: AccessProfile,
  raw: unknown,
  correlationId: string,
) {
  if (!accessCan(access, "knowledge.author")) throw new KnowledgeError("denied");
  const input = parseKnowledgeInput(articleInputSchema.safeParse(raw));
  return database.$transaction(async (tx) => {
    await validateOptionalReferences(tx, access, input);
    const article = await tx.knowledgeArticle.create({
      data: {
        organizationId: access.organizationId,
        title: input.title,
        summary: input.summary,
        body: input.body,
        audience: input.audience,
        categoryId: input.categoryId,
        ownerUserId: access.userId,
        reviewerUserId: input.reviewerUserId,
        reviewDate: input.reviewDate ? new Date(`${input.reviewDate}T00:00:00.000Z`) : null,
        sourceTicketId: input.sourceTicketId,
      },
    });
    await tx.knowledgeArticleVersion.create({
      data: {
        organizationId: access.organizationId,
        articleId: article.id,
        version: 1,
        title: input.title,
        summary: input.summary,
        body: input.body,
        audience: input.audience,
        categoryId: input.categoryId,
        changeSummary: input.changeSummary,
        createdByUserId: access.userId,
      },
    });
    if (input.assetId)
      await tx.knowledgeArticleAsset.create({
        data: {
          organizationId: access.organizationId,
          articleId: article.id,
          assetId: input.assetId,
        },
      });
    await tx.auditEvent.create({
      data: {
        organizationId: access.organizationId,
        actorUserId: access.userId,
        action: input.sourceTicketId ? "knowledge.proposed" : "knowledge.created",
        entityType: "knowledge_article",
        entityId: article.id,
        result: "success",
        correlationId,
        metadata: { audience: input.audience, sourceTicketId: input.sourceTicketId ?? null },
      },
    });
    return article;
  });
}

export async function updateKnowledgeArticle(
  access: AccessProfile,
  raw: unknown,
  correlationId: string,
) {
  if (!accessCan(access, "knowledge.author")) throw new KnowledgeError("denied");
  const input = parseKnowledgeInput(articleInputSchema.safeParse(raw));
  if (!input.articleId || !input.expectedVersion) throw new KnowledgeError("invalid");
  return database.$transaction(async (tx) => {
    const current = await tx.knowledgeArticle.findFirst({
      where: { id: input.articleId, organizationId: access.organizationId },
      select: { id: true, ownerUserId: true, state: true, currentVersion: true },
    });
    if (
      !current ||
      (current.ownerUserId !== access.userId && !accessCan(access, "knowledge.publish"))
    )
      throw new KnowledgeError("not_found");
    if (!["draft", "in_review"].includes(current.state)) throw new KnowledgeError("workflow");
    await validateOptionalReferences(tx, access, input);
    const nextVersion = current.currentVersion + 1;
    const updated = await tx.knowledgeArticle.updateMany({
      where: {
        id: current.id,
        organizationId: access.organizationId,
        currentVersion: input.expectedVersion,
      },
      data: {
        title: input.title,
        summary: input.summary,
        body: input.body,
        audience: input.audience,
        categoryId: input.categoryId ?? null,
        reviewerUserId: input.reviewerUserId ?? null,
        reviewDate: input.reviewDate ? new Date(`${input.reviewDate}T00:00:00.000Z`) : null,
        currentVersion: nextVersion,
      },
    });
    if (updated.count !== 1) throw new KnowledgeError("conflict");
    await tx.knowledgeArticleVersion.create({
      data: {
        organizationId: access.organizationId,
        articleId: current.id,
        version: nextVersion,
        title: input.title,
        summary: input.summary,
        body: input.body,
        audience: input.audience,
        categoryId: input.categoryId,
        changeSummary: input.changeSummary,
        createdByUserId: access.userId,
      },
    });
    await tx.knowledgeArticleAsset.deleteMany({
      where: { articleId: current.id, organizationId: access.organizationId },
    });
    if (input.assetId)
      await tx.knowledgeArticleAsset.create({
        data: {
          organizationId: access.organizationId,
          articleId: current.id,
          assetId: input.assetId,
        },
      });
    await tx.auditEvent.create({
      data: {
        organizationId: access.organizationId,
        actorUserId: access.userId,
        action: "knowledge.revised",
        entityType: "knowledge_article",
        entityId: current.id,
        result: "success",
        correlationId,
        metadata: { version: nextVersion },
      },
    });
    return { id: current.id, currentVersion: nextVersion };
  });
}

export async function transitionKnowledgeArticle(
  access: AccessProfile,
  raw: unknown,
  correlationId: string,
) {
  const input = parseKnowledgeInput(transitionInputSchema.safeParse(raw));
  if (!accessCan(access, "knowledge.author")) throw new KnowledgeError("denied");
  return database.$transaction(async (tx) => {
    const article = await tx.knowledgeArticle.findFirst({
      where: { id: input.articleId, organizationId: access.organizationId },
      select: {
        id: true,
        state: true,
        ownerUserId: true,
        reviewerUserId: true,
        reviewDate: true,
        currentVersion: true,
      },
    });
    if (
      !article ||
      (article.ownerUserId !== access.userId &&
        article.reviewerUserId !== access.userId &&
        !accessCan(access, "knowledge.publish"))
    )
      throw new KnowledgeError("not_found");
    const toState = input.toState as KnowledgeState;
    if (!workflowTransitions[article.state as KnowledgeState]?.includes(toState))
      throw new KnowledgeError("workflow");
    if (["published", "retired"].includes(toState) && !accessCan(access, "knowledge.publish"))
      throw new KnowledgeError("denied");
    if (
      toState === "published" &&
      (!article.reviewerUserId ||
        !article.reviewDate ||
        article.reviewerUserId === article.ownerUserId)
    )
      throw new KnowledgeError("workflow");
    const now = new Date();
    const updated = await tx.knowledgeArticle.updateMany({
      where: {
        id: article.id,
        organizationId: access.organizationId,
        currentVersion: input.expectedVersion,
        state: article.state,
      },
      data: {
        state: toState,
        publishedAt: toState === "published" ? now : toState === "draft" ? null : undefined,
        retiredAt: toState === "retired" ? now : toState === "draft" ? null : undefined,
      },
    });
    if (updated.count !== 1) throw new KnowledgeError("conflict");
    await tx.auditEvent.create({
      data: {
        organizationId: access.organizationId,
        actorUserId: access.userId,
        action: `knowledge.${toState}`,
        entityType: "knowledge_article",
        entityId: article.id,
        result: "success",
        correlationId,
        metadata: { fromState: article.state, toState, version: article.currentVersion },
      },
    });
    return { id: article.id, state: toState };
  });
}

export async function recordKnowledgeFeedback(
  access: AccessProfile,
  raw: unknown,
  correlationId: string,
) {
  const input = parseKnowledgeInput(feedbackInputSchema.safeParse(raw));
  const article = await database.knowledgeArticle.findFirst({
    where: { id: input.articleId, organizationId: access.organizationId },
    select: {
      id: true,
      state: true,
      audience: true,
      ownerUserId: true,
      reviewerUserId: true,
      currentVersion: true,
    },
  });
  if (!article || !canRead(access, article) || article.state !== "published")
    throw new KnowledgeError("not_found");
  await database.$transaction(async (tx) => {
    await tx.knowledgeFeedback.upsert({
      where: {
        articleId_articleVersion_userId: {
          articleId: article.id,
          articleVersion: article.currentVersion,
          userId: access.userId,
        },
      },
      create: {
        organizationId: access.organizationId,
        articleId: article.id,
        articleVersion: article.currentVersion,
        userId: access.userId,
        helpful: input.helpful,
      },
      update: { helpful: input.helpful },
    });
    await tx.auditEvent.create({
      data: {
        organizationId: access.organizationId,
        actorUserId: access.userId,
        action: "knowledge.feedback",
        entityType: "knowledge_article",
        entityId: article.id,
        result: "success",
        correlationId,
        metadata: { version: article.currentVersion, helpful: input.helpful },
      },
    });
  });
}

export async function linkKnowledgeToTicket(
  access: AccessProfile,
  raw: unknown,
  correlationId: string,
) {
  if (!accessCan(access, "knowledge.link")) throw new KnowledgeError("denied");
  const input = parseKnowledgeInput(ticketLinkInputSchema.safeParse(raw));
  return database.$transaction(async (tx) => {
    const [article, ticket] = await Promise.all([
      tx.knowledgeArticle.findFirst({
        where: { id: input.articleId, organizationId: access.organizationId },
        select: {
          id: true,
          title: true,
          state: true,
          audience: true,
          ownerUserId: true,
          reviewerUserId: true,
          currentVersion: true,
        },
      }),
      tx.ticket.findFirst({
        where: { id: input.ticketId, organizationId: access.organizationId },
        select: { id: true, propertyId: true },
      }),
    ]);
    if (
      !article ||
      !ticket ||
      article.state !== "published" ||
      !canRead(access, article) ||
      !accessCan(access, "ticket.queue.read", {
        organizationId: access.organizationId,
        propertyId: ticket.propertyId,
      })
    )
      throw new KnowledgeError("not_found");
    const link = await tx.knowledgeTicketLink.upsert({
      where: { articleId_ticketId: { articleId: article.id, ticketId: ticket.id } },
      create: {
        organizationId: access.organizationId,
        articleId: article.id,
        ticketId: ticket.id,
        linkedByUserId: access.userId,
      },
      update: {},
    });
    await tx.ticketActivity.create({
      data: {
        organizationId: access.organizationId,
        ticketId: ticket.id,
        actorUserId: access.userId,
        activityType: "knowledge_linked",
        requesterVisible: article.audience === "staff",
        metadata: {
          articleId: article.id,
          articleVersion: article.currentVersion,
          title: article.title,
          audience: article.audience,
        },
      },
    });
    await tx.auditEvent.create({
      data: {
        organizationId: access.organizationId,
        propertyId: ticket.propertyId,
        actorUserId: access.userId,
        action: "knowledge.linked",
        entityType: "ticket",
        entityId: ticket.id,
        result: "success",
        correlationId,
        metadata: {
          articleId: article.id,
          articleVersion: article.currentVersion,
          audience: article.audience,
        },
      },
    });
    return link;
  });
}
