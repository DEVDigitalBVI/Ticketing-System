import type { BreakdownRow } from "@/server/reporting/kpis";

export function ReportChart({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: BreakdownRow[];
}) {
  const largest = Math.max(1, ...rows.map((row) => row.value));
  return (
    <section className="report-panel" aria-labelledby={`report-${title.replaceAll(" ", "-")}`}>
      <div className="report-panel-heading">
        <div>
          <h2 id={`report-${title.replaceAll(" ", "-")}`}>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {rows.length ? (
        <>
          <div className="report-bars" aria-hidden="true">
            {rows.slice(0, 8).map((row) => (
              <div className="report-bar-row" key={row.key}>
                <span>{row.label}</span>
                <span className="report-bar-track">
                  <span style={{ width: `${(row.value / largest) * 100}%` }} />
                </span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
          <div className="table-scroll">
            <table className="report-table">
              <caption>{title}. The table contains the same values as the chart.</caption>
              <thead>
                <tr>
                  <th scope="col">Group</th>
                  <th scope="col">Tickets</th>
                  <th scope="col">Share</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    <td>{row.value}</td>
                    <td>{row.percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="report-empty">
          <strong>No data for this view</strong>
          <p>Try a wider date range or remove a scope filter.</p>
        </div>
      )}
    </section>
  );
}
