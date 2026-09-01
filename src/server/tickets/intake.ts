import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import { accessCan } from "@/server/auth/authorization";
import type { AccessProfile } from "@/server/auth/access";
import { database } from "@/server/database/client";
import { createTicket, getTicketForAccess, TicketServiceError } from "@/server/tickets/service";
import { ticketImpactValues, ticketUrgencyValues } from "@/server/tickets/workflow";

const unsafeTextPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/;
const duplicateSubmissionWindowMs = 5 * 60 * 1000;
const optionalUuidField = z.preprocess(
  (value) =>
    (typeof value === "string" && value.trim() === "") || value == null ? undefined : value,
  z.string().uuid().optional(),
);

const formSchema = z.object({
  summary: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .refine((value) => !unsafeTextPattern.test(value), "Unsafe characters are not allowed."),
  description: z
    .string()
    .trim()
    .min(2)
    .max(4000)
    .refine((value) => !unsafeTextPattern.test(value), "Unsafe characters are not allowed."),
  affectedUserId: optionalUuidField,
  propertyId: z.string().uuid(),
  serviceLocationId: optionalUuidField,
  departmentId: optionalUuidField,
  categoryId: z.string().uuid(),
  subcategoryId: optionalUuidField,
  impact: z.enum(ticketImpactValues),
  urgency: z.enum(ticketUrgencyValues),
});

type SubmissionCookieRecord = {
  fingerprint: string;
  ticketId: string;
  ticketNumber: string;
  createdAt: string;
};

export const ticketSubmissionCookieName = "ticket_intake_last_submission";

export type NewTicketFormOptions = {
  properties: Array<{ id: string; name: string }>;
  serviceLocations: Array<{ id: string; propertyId: string; name: string }>;
  departments: Array<{ id: string; propertyId: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  subcategories: Array<{ id: string; categoryId: string; name: string }>;
};

export type NewTicketSubmissionResult =
  | {
      kind: "created";
      ticketId: string;
      ticketNumber: string;
      cookieValue: string;
    }
  | {
      kind: "duplicate";
      ticketId: string;
      ticketNumber: string;
      cookieValue: string;
    };

function parseFormData(formData: FormData) {
  const parsed = formSchema.safeParse({
    summary: formData.get("summary"),
    description: formData.get("details"),
    affectedUserId: formData.get("affectedUserId"),
    propertyId: formData.get("propertyId"),
    serviceLocationId: formData.get("serviceLocationId"),
    departmentId: formData.get("departmentId"),
    categoryId: formData.get("categoryId"),
    subcategoryId: formData.get("subcategoryId"),
    impact: formData.get("impact"),
    urgency: formData.get("urgency"),
  });

  if (!parsed.success) throw new TicketServiceError("invalid");
  return parsed.data;
}

function fingerprintFor(access: AccessProfile, input: z.infer<typeof formSchema>) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        userId: access.userId,
        propertyId: input.propertyId,
        serviceLocationId: input.serviceLocationId ?? null,
        departmentId: input.departmentId ?? null,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId ?? null,
        impact: input.impact,
        urgency: input.urgency,
        summary: input.summary.trim().toLowerCase(),
        description: input.description.trim().toLowerCase(),
      }),
    )
    .digest("base64url");
}

function serializeCookie(record: SubmissionCookieRecord) {
  return Buffer.from(JSON.stringify(record), "utf8").toString("base64url");
}

export function parseTicketSubmissionCookie(value: string | undefined) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<SubmissionCookieRecord>;
    if (
      typeof parsed.fingerprint !== "string" ||
      typeof parsed.ticketId !== "string" ||
      typeof parsed.ticketNumber !== "string" ||
      typeof parsed.createdAt !== "string"
    ) {
      return null;
    }
    return parsed as SubmissionCookieRecord;
  } catch {
    return null;
  }
}

export async function listNewTicketFormOptions(
  access: AccessProfile,
): Promise<NewTicketFormOptions> {
  const propertyIds = access.properties.map((property) => property.id);

  const [properties, serviceLocations, departments, categories, subcategories] = await Promise.all([
    database.property.findMany({
      where: { organizationId: access.organizationId, isActive: true, id: { in: propertyIds } },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }],
    }),
    database.serviceLocation.findMany({
      where: {
        organizationId: access.organizationId,
        isActive: true,
        propertyId: { in: propertyIds },
      },
      select: { id: true, propertyId: true, name: true },
      orderBy: [{ property: { name: "asc" } }, { name: "asc" }],
    }),
    database.department.findMany({
      where: {
        organizationId: access.organizationId,
        isActive: true,
        propertyId: { in: propertyIds },
      },
      select: { id: true, propertyId: true, name: true },
      orderBy: [{ property: { name: "asc" } }, { name: "asc" }],
    }),
    database.ticketCategory.findMany({
      where: { organizationId: access.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }],
    }),
    database.ticketSubcategory.findMany({
      where: { organizationId: access.organizationId, isActive: true },
      select: { id: true, categoryId: true, name: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  return {
    properties,
    serviceLocations,
    departments,
    categories,
    subcategories,
  };
}

export async function submitNewTicketRequest(
  access: AccessProfile,
  formData: FormData,
  correlationId: string,
  existingSubmissionCookie?: string,
  dependencies: {
    createTicketFn?: typeof createTicket;
    getTicketForAccessFn?: typeof getTicketForAccess;
    now?: () => Date;
  } = {},
): Promise<NewTicketSubmissionResult> {
  const input = parseFormData(formData);

  if (
    input.affectedUserId &&
    input.affectedUserId !== access.userId &&
    !accessCan(access, "user.manage", { organizationId: access.organizationId })
  ) {
    throw new TicketServiceError("denied");
  }

  const createTicketFn = dependencies.createTicketFn ?? createTicket;
  const getTicketForAccessFn = dependencies.getTicketForAccessFn ?? getTicketForAccess;
  const now = dependencies.now ?? (() => new Date());
  const fingerprint = fingerprintFor(access, input);
  const priorSubmission = parseTicketSubmissionCookie(existingSubmissionCookie);

  if (priorSubmission?.fingerprint === fingerprint) {
    const createdAt = Date.parse(priorSubmission.createdAt);
    if (Number.isFinite(createdAt) && now().getTime() - createdAt <= duplicateSubmissionWindowMs) {
      const priorTicket = await getTicketForAccessFn(access, priorSubmission.ticketId);
      if (priorTicket?.ticketNumber === priorSubmission.ticketNumber) {
        return {
          kind: "duplicate",
          ticketId: priorSubmission.ticketId,
          ticketNumber: priorSubmission.ticketNumber,
          cookieValue: existingSubmissionCookie ?? serializeCookie(priorSubmission),
        };
      }
    }
  }

  const ticket = await createTicketFn(
    access,
    {
      summary: input.summary,
      description: input.description,
      affectedUserId: input.affectedUserId,
      propertyId: input.propertyId,
      serviceLocationId: input.serviceLocationId,
      departmentId: input.departmentId,
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId,
      impact: input.impact,
      urgency: input.urgency,
      source: "portal",
    },
    correlationId,
  );

  return {
    kind: "created",
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    cookieValue: serializeCookie({
      fingerprint,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      createdAt: now().toISOString(),
    }),
  };
}
