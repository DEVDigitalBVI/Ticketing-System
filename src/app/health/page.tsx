import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "System health",
  description: "Application-shell health status.",
};

export default function HealthPage() {
  return (
    <div className="utility-route">
      <main className="utility-card" id="main-content">
        <Link className="back-link" href="/">
          <span aria-hidden="true">←</span>Return to Service Desk
        </Link>
        <div className="utility-topline">
          <p className="overline">IT operations</p>
          <span className="status-pill progress">
            <span className="status-light" aria-hidden="true" />
            Operational
          </span>
        </div>
        <p className="overline">System check</p>
        <h1>All calm on the digital shoreline.</h1>
        <div className="utility-checks" aria-label="Application checks">
          <div>
            <span aria-hidden="true">✓</span>
            <strong>Application shell</strong>
            <small>Responding</small>
          </div>
          <div>
            <span aria-hidden="true">✓</span>
            <strong>Runtime boundary</strong>
            <small>Ready</small>
          </div>
        </div>
        <p className="utility-note">
          This page verifies the web application only. External services are intentionally not
          queried in this foundation release.
        </p>
      </main>
    </div>
  );
}
