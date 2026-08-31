import Link from "next/link";

export default function NotFound() {
  return (
    <div className="utility-route">
      <main className="utility-card utility-card-narrow" id="main-content">
        <p className="overline">404 · Outside the charted route</p>
        <h1>This page could not be found.</h1>
        <p className="lead">
          The address may have changed, or the destination may not be part of the Service Desk yet.
        </p>
        <Link className="primary-button" href="/">
          <span aria-hidden="true">←</span>Return to Service Desk
        </Link>
      </main>
    </div>
  );
}
