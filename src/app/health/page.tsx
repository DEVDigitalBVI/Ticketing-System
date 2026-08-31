import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { HealthPanel } from "@/components/site/health-panel";
import { ResortHeader } from "@/components/site/resort-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata: Metadata = {
  title: "System health",
  description: "Application-shell health status.",
};

export default function HealthPage() {
  return (
    <div className="site-shell health-route">
      <div className="ambient-orb" aria-hidden="true" />
      <ResortHeader context="System health" />

      <main className="health-route__main site-frame" id="main-content">
        <Link className="back-link" href="/">
          <ArrowLeft aria-hidden="true" />
          Return to Service Desk
        </Link>
        <HealthPanel headingLevel={1} titleId="health-title" />
      </main>

      <SiteFooter />
    </div>
  );
}
