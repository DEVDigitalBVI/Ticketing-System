import "server-only";

import { accessCan, permittedPropertyIds } from "@/server/auth/authorization";
import type { AccessProfile } from "@/server/auth/access";
import { database } from "@/server/database/client";
import { parseReportRange, reportFilterSchema } from "@/server/reporting/filters";
import { buildManagerReport, terminalStatuses } from "@/server/reporting/kpis";

const MAX_REPORT_FACTS = 50_000;

export class ReportingError extends Error {
  constructor(
    message: string,
    readonly code: "denied" | "invalid" | "too_large",
  ) {
    super(message);
    this.name = "ReportingError";
  }
}

export async function getReportingOptions(access: AccessProfile) {
  if (!accessCan(access, "report.read")) throw new ReportingError("Access denied.", "denied");
  const propertyIds = permittedPropertyIds(access, "report.read");
  const [properties, departments, categories, sources] = await Promise.all([
    database.property.findMany({
      where: { organizationId: access.organizationId, id: { in: propertyIds } },
      select: { id: true, name: true, timezone: true },
      orderBy: { name: "asc" },
    }),
    database.department.findMany({
      where: { organizationId: access.organizationId, propertyId: { in: propertyIds } },
      select: { id: true, name: true, propertyId: true },
      orderBy: { name: "asc" },
    }),
    database.ticketCategory.findMany({
      where: { organizationId: access.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    database.ticketReportingFact.findMany({
      where: { organizationId: access.organizationId, propertyId: { in: propertyIds } },
      distinct: ["source"],
      select: { source: true },
      orderBy: { source: "asc" },
    }),
  ]);
  return { properties, departments, categories, sources: sources.map((row) => row.source) };
}

export async function getManagerReport(access: AccessProfile, rawFilters: unknown) {
  if (!accessCan(access, "report.read")) throw new ReportingError("Access denied.", "denied");
  const parsed = reportFilterSchema.safeParse(rawFilters);
  if (!parsed.success) throw new ReportingError("Invalid report filters.", "invalid");
  const filters = parsed.data;
  const allowedProperties = permittedPropertyIds(access, "report.read");
  if (filters.propertyId && !allowedProperties.includes(filters.propertyId))
    throw new ReportingError("Access denied.", "denied");

  const timezoneAllowed = await database.property.count({
    where: {
      organizationId: access.organizationId,
      id: { in: filters.propertyId ? [filters.propertyId] : allowedProperties },
      timezone: filters.timezone,
    },
  });
  if (!timezoneAllowed) throw new ReportingError("Invalid reporting time zone.", "invalid");

  let range;
  try {
    range = parseReportRange(filters.from, filters.to, filters.timezone);
  } catch (error) {
    throw new ReportingError(error instanceof Error ? error.message : "Invalid report range.", "invalid");
  }

  const scopedProperties = filters.propertyId ? [filters.propertyId] : allowedProperties;
  const facts = await database.ticketReportingFact.findMany({
    where: {
      organizationId: access.organizationId,
      propertyId: { in: scopedProperties },
      ticketCreatedAt: { lt: range.end },
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.source ? { source: filters.source } : {}),
      OR: [
        { ticketCreatedAt: { gte: range.start } },
        { resolvedAt: { gte: range.start } },
        { status: { notIn: [...terminalStatuses] } },
      ],
    },
    select: {
      ticketId: true,
      propertyId: true,
      propertyName: true,
      reportingTimezone: true,
      departmentId: true,
      departmentName: true,
      categoryId: true,
      categoryName: true,
      primaryAssetId: true,
      assetTag: true,
      assetName: true,
      assigneeUserId: true,
      assigneeDisplayName: true,
      source: true,
      priority: true,
      status: true,
      ticketCreatedAt: true,
      firstRespondedAt: true,
      resolvedAt: true,
      closedAt: true,
      cancelledAt: true,
      requesterWaitingSeconds: true,
      requesterWaitingSince: true,
      reopenCount: true,
      slaPolicySnapshot: true,
      slaResponseDueAt: true,
      slaResolutionDueAt: true,
      isAlertGenerated: true,
      ticket: { select: { _count: { select: { knowledgeLinks: true } } } },
    },
    orderBy: { ticketCreatedAt: "asc" },
    take: MAX_REPORT_FACTS + 1,
  });
  if (facts.length > MAX_REPORT_FACTS)
    throw new ReportingError(
      "This report contains too many records. Narrow the date or scope filters.",
      "too_large",
    );

  return buildManagerReport(
    facts.map(({ ticket, ...fact }) => ({ ...fact, knowledgeLinks: ticket._count.knowledgeLinks })),
    range,
  );
}
