import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { isAuthorized, type AuthorizationSubject } from "@/modules/auth/authorization";
import { ReportChart } from "@/modules/reporting/report-chart";
import { defaultSlaPolicy } from "@/server/sla/policy";
import { escapeCsvCell, reportToCsv } from "@/server/reporting/csv";
import { parseReportRange } from "@/server/reporting/filters";
import { buildManagerReport, type ReportingFact } from "@/server/reporting/kpis";

function fact(overrides: Partial<ReportingFact> = {}): ReportingFact {
  return {
    ticketId: "synthetic-001",
    propertyId: "property-1",
    propertyName: "Harbour Resort",
    reportingTimezone: "America/Tortola",
    departmentId: "department-1",
    departmentName: "Front Office",
    categoryId: "category-1",
    categoryName: "Workstation",
    primaryAssetId: "asset-1",
    assetTag: "PIR-IT-001",
    assetName: "Front desk workstation",
    assigneeUserId: "technician-1",
    assigneeDisplayName: "Alex Technician",
    source: "portal",
    priority: "P3",
    status: "resolved",
    ticketCreatedAt: new Date("2026-08-03T12:00:00.000Z"),
    firstRespondedAt: new Date("2026-08-03T13:00:00.000Z"),
    resolvedAt: new Date("2026-08-03T16:00:00.000Z"),
    closedAt: null,
    cancelledAt: null,
    requesterWaitingSeconds: 0,
    requesterWaitingSince: null,
    reopenCount: 0,
    slaPolicySnapshot: defaultSlaPolicy,
    slaResponseDueAt: new Date("2026-08-03T14:00:00.000Z"),
    slaResolutionDueAt: new Date("2026-08-04T21:00:00.000Z"),
    isAlertGenerated: false,
    knowledgeLinks: 0,
    ...overrides,
  };
}

const august = parseReportRange("2026-08-01", "2026-08-31", "America/Tortola");

describe("Step 27 KPI definitions", () => {
  it("independently reproduces volume from the same synthetic records", () => {
    const report = buildManagerReport(
      [
        fact(),
        fact({ ticketId: "synthetic-002", ticketCreatedAt: new Date("2026-08-31T23:59:59Z") }),
        fact({ ticketId: "outside", ticketCreatedAt: new Date("2026-09-01T04:00:00Z") }),
      ],
      august,
    );
    expect(report.cards.volume).toBe(2);
    expect(report.reproducibility).toEqual({
      kpi: "Ticket volume",
      includedTicketIds: ["synthetic-001", "synthetic-002"],
      result: 2,
    });
  });

  it("uses captured support calendars for response and resolution KPIs", () => {
    const report = buildManagerReport([fact()], august);
    expect(report.cards.averageFirstResponseMinutes).toBe(60);
    expect(report.cards.averageResolutionMinutes).toBe(240);
    expect(report.cards.responseSlaPercent).toBe(100);
    expect(report.cards.resolutionSlaPercent).toBe(100);
  });

  it("separates backlog, reopen, alert, requester-waiting, workload, recurrence, and reuse", () => {
    const open = fact({
      ticketId: "synthetic-002",
      status: "waiting_for_requester",
      firstRespondedAt: null,
      resolvedAt: null,
      requesterWaitingSeconds: 3600,
      requesterWaitingSince: new Date("2026-08-31T04:00:00Z"),
      reopenCount: 1,
      isAlertGenerated: true,
      knowledgeLinks: 1,
    });
    const report = buildManagerReport([fact(), open], august);
    expect(report.cards.backlog).toBe(1);
    expect(report.cards.alertGeneratedTickets).toBe(1);
    expect(report.cards.knowledgeReusePercent).toBe(50);
    expect(report.breakdowns.technicianWorkload[0]?.label).toBe("Alex Technician");
    expect(report.breakdowns.recurringAssets[0]?.value).toBe(2);
    expect(report.cards.averageRequesterWaitingHours).toBeGreaterThan(0);
  });

  it("aggregates 20,000 realistic facts within the interactive performance budget", () => {
    const facts = Array.from({ length: 20_000 }, (_, index) => {
      const day = (index % 28) + 1;
      const created = new Date(`2026-08-${day.toString().padStart(2, "0")}T12:00:00.000Z`);
      return fact({
        ticketId: `synthetic-${index}`,
        priority: `P${(index % 4) + 1}`,
        categoryId: `category-${index % 12}`,
        categoryName: `Category ${index % 12}`,
        primaryAssetId: `asset-${index % 800}`,
        ticketCreatedAt: created,
        firstRespondedAt: new Date(created.getTime() + 3_600_000),
        resolvedAt: new Date(created.getTime() + 14_400_000),
      });
    });
    const started = performance.now();
    const report = buildManagerReport(facts, august);
    expect(report.cards.volume).toBe(20_000);
    expect(performance.now() - started).toBeLessThan(1_500);
  });
});

describe("report boundaries and exports", () => {
  it("uses local midnights across a daylight-saving change", () => {
    const range = parseReportRange("2026-03-08", "2026-03-08", "America/New_York");
    expect(range.start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });

  it("escapes delimiters, quotes, newlines, and spreadsheet formulas", () => {
    expect(escapeCsvCell('Desk, "east"\nwing')).toBe('"Desk, ""east""\nwing"');
    expect(escapeCsvCell('=HYPERLINK("bad")')).toBe('"\'=HYPERLINK(""bad"")"');
    const csv = reportToCsv(buildManagerReport([fact()], august));
    expect(csv).not.toContain("Front desk workstation");
    expect(csv).not.toContain("synthetic-001");
  });

  it("allows only report roles and keeps property scope enforced", () => {
    const subject: AuthorizationSubject = {
      userId: "user-1",
      organizationId: "org-1",
      propertyIds: ["property-1"],
      departmentIds: [],
      roles: ["report_viewer"],
      roleAssignments: [{ propertyId: "property-1", role: "report_viewer" }],
    };
    expect(
      isAuthorized(subject, "report.read", { organizationId: "org-1", propertyId: "property-1" }),
    ).toBe(true);
    expect(
      isAuthorized(subject, "report.read", { organizationId: "org-1", propertyId: "property-2" }),
    ).toBe(false);
    expect(
      isAuthorized(
        {
          ...subject,
          roles: ["requester"],
          roleAssignments: [{ propertyId: "property-1", role: "requester" }],
        },
        "report.read",
      ),
    ).toBe(false);
  });

  it("pairs each visual chart with a readable equivalent table", () => {
    render(
      <ReportChart
        title="Tickets by priority"
        description="Created in period"
        rows={[{ key: "P1", label: "P1", value: 4, percent: 40 }]}
      />,
    );
    expect(screen.getByText("Created in period")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: /same values as the chart/i });
    expect(within(table).getByRole("rowheader", { name: "P1" })).toBeInTheDocument();
    expect(within(table).getByText("40%")).toBeInTheDocument();
  });
});
