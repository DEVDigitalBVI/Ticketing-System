import { z } from "zod";

export const knowledgeStates = ["draft", "in_review", "published", "retired"] as const;
export const knowledgeAudiences = ["staff", "technician"] as const;

const optionalUuid = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().uuid().optional(),
);
const optionalDate = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().date().optional(),
);

export const articleInputSchema = z.object({
  articleId: optionalUuid,
  title: z.string().trim().min(3).max(180),
  summary: z.string().trim().min(10).max(500),
  body: z.string().trim().min(10).max(50_000),
  audience: z.enum(knowledgeAudiences),
  categoryId: optionalUuid,
  reviewerUserId: optionalUuid,
  reviewDate: optionalDate,
  sourceTicketId: optionalUuid,
  assetId: optionalUuid,
  changeSummary: z.string().trim().min(3).max(500),
  expectedVersion: z.coerce.number().int().positive().optional(),
});

export const transitionInputSchema = z.object({
  articleId: z.string().uuid(),
  toState: z.enum(knowledgeStates),
  expectedVersion: z.coerce.number().int().positive(),
});

export const feedbackInputSchema = z.object({
  articleId: z.string().uuid(),
  helpful: z.enum(["yes", "no"]).transform((value) => value === "yes"),
});

export const ticketLinkInputSchema = z.object({
  articleId: z.string().uuid(),
  ticketId: z.string().uuid(),
});

export const searchInputSchema = z.object({
  query: z.string().trim().max(120).optional().default(""),
  categoryId: optionalUuid,
  state: z.enum(knowledgeStates).optional(),
  stale: z.enum(["1"]).optional(),
  ticket: optionalUuid,
});

export type KnowledgeState = (typeof knowledgeStates)[number];
export type KnowledgeAudience = (typeof knowledgeAudiences)[number];

export class KnowledgeError extends Error {
  constructor(
    public readonly code: "denied" | "invalid" | "not_found" | "conflict" | "workflow" | "ticket",
  ) {
    super(code === "denied" ? "Access denied." : "Knowledge request could not be completed.");
    this.name = "KnowledgeError";
  }
}

export const workflowTransitions: Record<KnowledgeState, readonly KnowledgeState[]> = {
  draft: ["in_review"],
  in_review: ["draft", "published"],
  published: ["retired"],
  retired: ["draft"],
};

export function isStaleArticle(reviewDate: Date | null, now = new Date()) {
  return Boolean(
    reviewDate &&
    reviewDate.getTime() < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function parseKnowledgeInput<T>(result: { success: boolean; data?: T }): T {
  if (!result.success || result.data === undefined) throw new KnowledgeError("invalid");
  return result.data;
}
