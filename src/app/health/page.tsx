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
            Web process responding
          </span>
        </div>
        <p className="overline">System check</p>
        <h1>The service desk is responding.</h1>
        <div className="utility-checks" aria-label="Application checks">
          <div>
            <span aria-hidden="true">✓</span>
            <strong>Application shell</strong>
            <small>Responding</small>
          </div>
          <div>
            <span aria-hidden="true">✓</span>
            <strong>Liveness probe</strong>
            <small>/health/live</small>
          </div>
        </div>
        <p className="utility-note">
          This page confirms liveness only. The readiness probe checks the service database and
          worker heartbeat; authorized IT staff can review full dependency health in Operations.
        </p>
      </main>
    </div>
  );
}
