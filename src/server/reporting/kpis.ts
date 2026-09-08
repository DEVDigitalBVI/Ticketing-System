import { parseSlaPolicySnapshot, supportMillisecondsBetween } from "@/server/sla/policy";

export const terminalStatuses = ["resolved", "closed", "cancelled"] as const;

export type ReportingFact = {
  ticketId: string;
  propertyId: string;
  propertyName: string;
  reportingTimezone: string;
  departmentId: string | null;
  departmentName: string | null;
  categoryId: string;
  categoryName: string;
  primaryAssetId: string | null;
  assetTag: string | null;
  assetName: string | null;
  assigneeUserId: string | null;
  assigneeDisplayName: string | null;
  source: string;
  priority: string;
  status: string;
  ticketCreatedAt: Date;
  firstRespondedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  cancelledAt: Date | null;
  requesterWaitingSeconds: number;
  requesterWaitingSince: Date | null;
  reopenCount: number;
  slaPolicySnapshot: unknown;
  slaResponseDueAt: Date | null;
  slaResolutionDueAt: Date | null;
  isAlertGenerated: boolean;
  knowledgeLinks: number;
};

export type ReportRange = { start: Date; end: Date; timezone: string };
export type BreakdownRow = { key: string; label: string; value: number; percent: number };

export type ManagerReport = {
  range: ReportRange;
  population: number;
  cards: {
    volume: number;
    backlog: number;
    averageBacklogAgeHours: number | null;
    averageFirstResponseMinutes: number | null;
    averageResolutionMinutes: number | null;
    responseSlaPercent: number | null;
    resolutionSlaPercent: number | null;
    reopenRatePercent: number | null;
    averageRequesterWaitingHours: number | null;
    alertGeneratedTickets: number;
    knowledgeReusePercent: number | null;
  };
  breakdowns: {
    priority: BreakdownRow[];
    category: BreakdownRow[];
    property: BreakdownRow[];
    department: BreakdownRow[];
    source: BreakdownRow[];
    age: BreakdownRow[];
    technicianWorkload: BreakdownRow[];
    recurringAssets: BreakdownRow[];
  };
  reproducibility: {
    kpi: "Ticket volume";
    includedTicketIds: string[];
    result: number;
  };
};

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number | null, digits = 1) {
  return value === null ? null : Number(value.toFixed(digits));
}

function percent(numerator: number, denominator: number) {
  return denominator ? round((numerator / denominator) * 100) : null;
}

function breakdown(entries: Array<{ key: string; label: string }>, denominator: number) {
  const groups = new Map<string, { label: string; value: number }>();
  for (const entry of entries) {
    const current = groups.get(entry.key);
    groups.set(entry.key, { label: entry.label, value: (current?.value ?? 0) + 1 });
  }
  return [...groups.entries()]
    .map(([key, row]) => ({
      key,
      label: row.label,
      value: row.value,
      percent: denominator ? Number(((row.value / denominator) * 100).toFixed(1)) : 0,
    }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
}

function supportMinutes(start: Date, end: Date, snapshot: unknown) {
  const policy = parseSlaPolicySnapshot(snapshot);
  if (!policy) return null;
  return supportMillisecondsBetween(start, end, policy) / 60_000;
}

function isCreatedInRange(fact: ReportingFact, range: ReportRange) {
  return fact.ticketCreatedAt >= range.start && fact.ticketCreatedAt < range.end;
}

function isResolvedInRange(fact: ReportingFact, range: ReportRange) {
  return Boolean(fact.resolvedAt && fact.resolvedAt >= range.start && fact.resolvedAt < range.end);
}

function backlogAtEnd(fact: ReportingFact, end: Date) {
  if (fact.ticketCreatedAt >= end) return false;
  const terminalAt = fact.cancelledAt ?? fact.closedAt ?? fact.resolvedAt;
  return !terminalAt || terminalAt >= end;
}

function ageBand(hours: number) {
  if (hours < 24) return { key: "under_24h", label: "Under 24 hours" };
  if (hours < 72) return { key: "one_to_three_days", label: "1–3 days" };
  if (hours < 168) return { key: "three_to_seven_days", label: "3–7 days" };
  return { key: "over_seven_days", label: "Over 7 days" };
}

export function buildManagerReport(facts: ReportingFact[], range: ReportRange): ManagerReport {
  const created = facts.filter((fact) => isCreatedInRange(fact, range));
  const resolved = facts.filter((fact) => isResolvedInRange(fact, range));
  const backlog = facts.filter((fact) => backlogAtEnd(fact, range.end));
  const responses = created.flatMap((fact) => {
    if (!fact.firstRespondedAt) return [];
    const minutes = supportMinutes(fact.ticketCreatedAt, fact.firstRespondedAt, fact.slaPolicySnapshot);
    return minutes === null ? [] : [minutes];
  });
  const resolutions = resolved.flatMap((fact) => {
    if (!fact.resolvedAt) return [];
    const minutes = supportMinutes(fact.ticketCreatedAt, fact.resolvedAt, fact.slaPolicySnapshot);
    return minutes === null ? [] : [minutes];
  });
  const responsePopulation = created.filter(
    (fact) => fact.firstRespondedAt && fact.slaResponseDueAt,
  );
  const resolutionPopulation = resolved.filter(
    (fact) => fact.resolvedAt && fact.slaResolutionDueAt,
  );
  const backlogAges = backlog.map(
    (fact) => Math.max(0, range.end.getTime() - fact.ticketCreatedAt.getTime()) / 3_600_000,
  );
  const waitingHours = created.map((fact) => {
    const activeWaiting = fact.requesterWaitingSince
      ? Math.max(0, range.end.getTime() - fact.requesterWaitingSince.getTime()) / 1000
      : 0;
    return (fact.requesterWaitingSeconds + activeWaiting) / 3600;
  });
  const linked = created.filter((fact) => fact.knowledgeLinks > 0).length;

  return {
    range,
    population: created.length,
    cards: {
      volume: created.length,
      backlog: backlog.length,
      averageBacklogAgeHours: round(average(backlogAges)),
      averageFirstResponseMinutes: round(average(responses)),
      averageResolutionMinutes: round(average(resolutions)),
      responseSlaPercent: percent(
        responsePopulation.filter(
          (fact) => fact.firstRespondedAt! <= fact.slaResponseDueAt!,
        ).length,
        responsePopulation.length,
      ),
      resolutionSlaPercent: percent(
        resolutionPopulation.filter((fact) => fact.resolvedAt! <= fact.slaResolutionDueAt!).length,
        resolutionPopulation.length,
      ),
      reopenRatePercent: percent(
        resolved.filter((fact) => fact.reopenCount > 0).length,
        resolved.length,
      ),
      averageRequesterWaitingHours: round(average(waitingHours)),
      alertGeneratedTickets: created.filter((fact) => fact.isAlertGenerated).length,
      knowledgeReusePercent: percent(linked, created.length),
    },
    breakdowns: {
      priority: breakdown(
        created.map((fact) => ({ key: fact.priority, label: fact.priority })),
        created.length,
      ),
      category: breakdown(
        created.map((fact) => ({ key: fact.categoryId, label: fact.categoryName })),
        created.length,
      ),
      property: breakdown(
        created.map((fact) => ({ key: fact.propertyId, label: fact.propertyName })),
        created.length,
      ),
      department: breakdown(
        created.map((fact) => ({
          key: fact.departmentId ?? "unassigned",
          label: fact.departmentName ?? "No department",
        })),
        created.length,
      ),
      source: breakdown(
        created.map((fact) => ({ key: fact.source, label: fact.source })),
        created.length,
      ),
      age: breakdown(backlogAges.map(ageBand), backlog.length),
      technicianWorkload: breakdown(
        backlog.map((fact) => ({
          key: fact.assigneeUserId ?? "unassigned",
          label: fact.assigneeDisplayName ?? "Unassigned",
        })),
        backlog.length,
      ),
      recurringAssets: breakdown(
        created
          .filter((fact) => fact.primaryAssetId)
          .map((fact) => ({
            key: fact.primaryAssetId!,
            label: fact.assetTag ? `${fact.assetTag} · ${fact.assetName ?? "Asset"}` : "Asset",
          })),
        created.filter((fact) => fact.primaryAssetId).length,
      ).filter((row) => row.value > 1),
    },
    reproducibility: {
      kpi: "Ticket volume",
      includedTicketIds: created.map((fact) => fact.ticketId).sort(),
      result: created.length,
    },
  };
}
