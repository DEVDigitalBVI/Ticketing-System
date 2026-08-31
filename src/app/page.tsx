import Link from "next/link";
import { ArrowUpRight, Compass, RadioTower, ShieldCheck, Waves } from "lucide-react";

import { HealthPanel } from "@/components/site/health-panel";
import { ResortHeader } from "@/components/site/resort-header";
import { SiteFooter } from "@/components/site/site-footer";
import { StatusBadge } from "@/components/ui/status-badge";

const principles = [
  {
    number: "01",
    title: "Clear by design",
    description: "Strong hierarchy and direct language keep operational information easy to scan.",
    icon: Compass,
  },
  {
    number: "02",
    title: "Ready across the island",
    description: "A responsive foundation designed for the varied screens used by resort teams.",
    icon: Waves,
  },
  {
    number: "03",
    title: "Trust through honesty",
    description: "Every status states exactly which system boundary has—and has not—been checked.",
    icon: ShieldCheck,
  },
] as const;

export default function HomePage() {
  return (
    <div className="site-shell">
      <div className="ambient-orb" aria-hidden="true" />
      <ResortHeader context="IT Service Desk · Foundation" />

      <main id="main-content">
        <section className="hero-section site-frame" aria-labelledby="service-desk-title">
          <div className="landing-copy">
            <StatusBadge>
              <RadioTower aria-hidden="true" />
              Foundation online
            </StatusBadge>
            <p className="eyebrow">Information Technology</p>
            <h1 id="service-desk-title">Service Desk</h1>
            <p className="lede">
              A dependable digital foundation for the people who keep the island connected.
            </p>
          </div>

          <div className="hero-footer">
            <p>Peter Island operations · British Virgin Islands</p>
            <Link className="text-link" href="/health">
              View system health
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="principles-section site-frame" aria-labelledby="principles-title">
          <div className="section-intro section-intro--compact">
            <div>
              <p className="section-label">Built for island operations</p>
              <h2 id="principles-title">Quiet confidence, engineered in.</h2>
            </div>
            <p>
              Resort hospitality depends on technology that feels present when needed and invisible
              when everything is working. This foundation is designed around that balance.
            </p>
          </div>

          <div className="principles-grid">
            {principles.map(({ number, title, description, icon: Icon }) => (
              <article className="principle" key={number}>
                <div className="principle__topline">
                  <span>{number}</span>
                  <Icon aria-hidden="true" strokeWidth={1.35} />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="health-section site-frame" aria-labelledby="health-section-title">
          <div className="section-intro">
            <div>
              <p className="section-label">Application readiness</p>
              <h2 id="health-section-title">Calm, clear, connected.</h2>
            </div>
            <p>
              The current release verifies the web foundation without overstating the readiness of
              services that have not yet been connected.
            </p>
          </div>
          <HealthPanel titleId="embedded-health-title" />
        </section>

        <section className="scope-section site-frame" aria-labelledby="scope-title">
          <div>
            <p className="section-label">Foundation scope</p>
            <h2 id="scope-title">Designed now. Expanded with purpose.</h2>
          </div>
          <div className="scope-copy">
            <p>
              This release establishes the visual language, responsive shell, system-health pattern,
              and engineering quality gates for Peter Island Resort and Spa.
            </p>
            <p>
              Ticket intake, queues, assignments, authentication, reporting, and database behavior
              remain intentionally deferred until their workflows and access rules are approved.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
