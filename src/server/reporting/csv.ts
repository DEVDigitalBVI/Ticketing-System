import type { ManagerReport } from "@/server/reporting/kpis";

export function escapeCsvCell(value: string | number | null) {
  let text = value === null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function reportToCsv(report: ManagerReport) {
  const rows: Array<Array<string | number | null>> = [
    ["KPI", "Scope", "Value", "Unit"],
    ["Ticket volume", "Selected scope", report.cards.volume, "tickets"],
    ["Backlog", "At period end", report.cards.backlog, "tickets"],
    ["Average backlog age", "At period end", report.cards.averageBacklogAgeHours, "hours"],
    ["First response", "Created tickets", report.cards.averageFirstResponseMinutes, "support minutes"],
    ["Resolution time", "Resolved tickets", report.cards.averageResolutionMinutes, "support minutes"],
    ["Response SLA attainment", "Eligible created tickets", report.cards.responseSlaPercent, "percent"],
    ["Resolution SLA attainment", "Eligible resolved tickets", report.cards.resolutionSlaPercent, "percent"],
    ["Reopen rate", "Resolved tickets", report.cards.reopenRatePercent, "percent"],
    ["Requester waiting time", "Created tickets", report.cards.averageRequesterWaitingHours, "hours"],
    ["Alert-generated tickets", "Created tickets", report.cards.alertGeneratedTickets, "tickets"],
    ["Knowledge reuse", "Created tickets", report.cards.knowledgeReusePercent, "percent"],
  ];
  for (const [name, values] of Object.entries(report.breakdowns)) {
    for (const row of values) rows.push([name, row.label, row.value, "tickets"]);
  }
  return `${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}\r\n`;
}
