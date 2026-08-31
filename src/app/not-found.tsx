import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

import { ResortHeader } from "@/components/site/resort-header";
import { SiteFooter } from "@/components/site/site-footer";

export default function NotFound() {
  return (
    <div className="site-shell not-found-route">
      <div className="ambient-orb" aria-hidden="true" />
      <ResortHeader context="Route unavailable" />

      <main className="not-found site-frame" id="main-content">
        <div className="not-found__mark" aria-hidden="true">
          <Compass strokeWidth={1.15} />
        </div>
        <p className="section-label">404 · Outside the charted route</p>
        <h1>This shoreline could not be found.</h1>
        <p>
          The address may have changed, or the destination may not be part of this foundation
          release.
        </p>
        <Link className="text-link" href="/">
          <ArrowLeft aria-hidden="true" />
          Return to Service Desk
        </Link>
      </main>

      <SiteFooter />
    </div>
  );
}
