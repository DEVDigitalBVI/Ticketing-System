import type { Metadata } from "next";

import { ReportChart } from "@/modules/reporting/report-chart";
import { PageHeader } from "@/modules/service-desk/components/page-header";
import { requireCurrentAccess } from "@/server/auth/authorization";
import { isDatabaseUnavailableError } from "@/server/database/errors";
import { getManagerReport, getReportingOptions, ReportingError } from "@/server/reporting/service";

export const metadata: Metadata = { title: "Service quality reports" };

type Search = {
  from?: string;
  to?: string;
  timezone?: string;
  propertyId?: string;
  departmentId?: string;
  categoryId?: string;
  source?: string;
};

function localDate(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function daysBefore(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! - days)).toISOString().slice(0, 10);
}

function metric(value: number | null, suffix = "") {
  return value === null ? "Not available" : `${value.toLocaleString()}${suffix}`;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const access = await requireCurrentAccess("report.read");
  const search = await searchParams;
  let options: Awaited<ReturnType<typeof getReportingOptions>> | undefined;
  let report: Awaited<ReturnType<typeof getManagerReport>> | undefined;
  let errorMessage: string | undefined;

  try {
    options = await getReportingOptions(access);
    const timezone = search.timezone ?? options.properties[0]?.timezone ?? "America/Tortola";
    const to = search.to ?? localDate(timezone);
    const from = search.from ?? daysBefore(to, 29);
    report = await getManagerReport(access, {
      from,
      to,
      timezone,
      ...(search.propertyId ? { propertyId: search.propertyId } : {}),
      ...(search.departmentId ? { departmentId: search.departmentId } : {}),
      ...(search.categoryId ? { categoryId: search.categoryId } : {}),
      ...(search.source ? { source: search.source } : {}),
    });
  } catch (error) {
    if (!isDatabaseUnavailableError(error) && !(error instanceof ReportingError)) throw error;
    errorMessage =
      error instanceof ReportingError
        ? error.message
        : "The reporting database is temporarily unavailable.";
  }

  const timezone = search.timezone ?? options?.properties[0]?.timezone ?? "America/Tortola";
  const to = search.to ?? localDate(timezone);
  const from = search.from ?? daysBefore(to, 29);
  const exportQuery = new URLSearchParams(
    Object.entries({
      from,
      to,
      timezone,
      propertyId: search.propertyId,
      departmentId: search.departmentId,
      categoryId: search.categoryId,
      source: search.source,
    }).flatMap(([key, value]) => (value ? [[key, value]] : [])),
  );

  return (
    <section className="view report-view" aria-labelledby="reports-title">
      <PageHeader
        eyebrow="Stable service measures"
        title="Service quality"
        titleId="reports-title"
        lead="A single, reproducible view of demand, response, resolution, workload, and recurring service patterns."
        actionHref={report ? `/reports/export?${exportQuery}` : undefined}
        actionLabel={report ? "Export approved CSV" : undefined}
      />

      {options ? (
        <form className="report-filter" method="get" aria-label="Report filters">
          <label>
            From
            <input type="date" name="from" defaultValue={from} required />
          </label>
          <label>
            To
            <input type="date" name="to" defaultValue={to} required />
          </label>
          <label>
            Property
            <select name="propertyId" defaultValue={search.propertyId ?? ""}>
              <option value="">All permitted properties</option>
              {options.properties.map((property) => (
                <option value={property.id} key={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Department
            <select name="departmentId" defaultValue={search.departmentId ?? ""}>
              <option value="">All departments</option>
              {options.departments.map((department) => (
                <option value={department.id} key={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select name="categoryId" defaultValue={search.categoryId ?? ""}>
              <option value="">All categories</option>
              {options.categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Source
            <select name="source" defaultValue={search.source ?? ""}>
              <option value="">All sources</option>
              {options.sources.map((source) => (
                <option value={source} key={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>
          <label>
            Time zone
            <select name="timezone" defaultValue={timezone}>
              {[...new Set(options.properties.map((property) => property.timezone))].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <button className="primary-button" type="submit">
            Apply filters
          </button>
        </form>
      ) : null}

      {errorMessage ? (
        <div className="empty-state" role="alert">
          <strong>Report unavailable</strong>
          <p>{errorMessage}</p>
        </div>
      ) : report ? (
        <>
          <p className="report-context">
            {from} through {to} · {report.range.timezone} · Calendar boundaries are local; SLA
            durations use each ticket’s captured support calendar.
          </p>
          <div className="report-metrics" aria-label="Key service measures">
            {[
              ["Ticket volume", metric(report.cards.volume)],
              ["Backlog", metric(report.cards.backlog)],
              ["Average backlog age", metric(report.cards.averageBacklogAgeHours, " h")],
              ["First response", metric(report.cards.averageFirstResponseMinutes, " min")],
              ["Resolution time", metric(report.cards.averageResolutionMinutes, " min")],
              ["Response SLA", metric(report.cards.responseSlaPercent, "%")],
              ["Resolution SLA", metric(report.cards.resolutionSlaPercent, "%")],
              ["Reopen rate", metric(report.cards.reopenRatePercent, "%")],
              ["Requester waiting", metric(report.cards.averageRequesterWaitingHours, " h")],
              ["Level alert tickets", metric(report.cards.alertGeneratedTickets)],
              ["Knowledge reuse", metric(report.cards.knowledgeReusePercent, "%")],
            ].map(([label, value]) => (
              <article className="report-metric" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          {report.population ? (
            <div className="report-grid">
              <ReportChart title="Tickets by priority" description="Created in the period." rows={report.breakdowns.priority} />
              <ReportChart title="Tickets by category" description="Uses the captured category label." rows={report.breakdowns.category} />
              <ReportChart title="Tickets by property" description="Uses the captured property label." rows={report.breakdowns.property} />
              <ReportChart title="Tickets by department" description="Created demand by requesting department." rows={report.breakdowns.department} />
              <ReportChart title="Tickets by source" description="Portal, email, technician, or system intake." rows={report.breakdowns.source} />
              <ReportChart title="Backlog age" description="Open workload at the end of the period." rows={report.breakdowns.age} />
              <ReportChart title="Technician workload" description="Open tickets by captured current assignee." rows={report.breakdowns.technicianWorkload} />
              <ReportChart title="Recurring assets" description="Assets with more than one ticket in the period." rows={report.breakdowns.recurringAssets} />
            </div>
          ) : (
            <div className="report-empty">
              <strong>No service records in this period</strong>
              <p>Choose a wider range or remove a scope filter.</p>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
