"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ApplicationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The server instrumentation records the safe diagnostic trail. Do not print the exception.
  }, [error]);

  return (
    <main className="utility-route" id="main-content">
      <section className="utility-card" role="alert">
        <p className="overline">Service desk</p>
        <h1>This section could not be loaded.</h1>
        <p className="utility-note">
          Your request was not lost. Try the section again, or return to the overview while IT
          checks the service connection.
        </p>
        <div className="error-actions">
          <button className="primary-button" type="button" onClick={reset}>
            Try again
          </button>
          <Link className="secondary-button" href="/">
            Return to overview
          </Link>
        </div>
        {error.digest ? <small className="error-reference">Reference: {error.digest}</small> : null}
      </section>
    </main>
  );
}
