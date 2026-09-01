import type { Metadata } from "next";

import { NewTicketForm } from "@/modules/service-desk/components/new-ticket-form";
import { PageHeader } from "@/modules/service-desk/components/page-header";
import { requireCurrentAccess } from "@/server/auth/authorization";
import { listNewTicketFormOptions } from "@/server/tickets/intake";

export const metadata: Metadata = { title: "Report an issue" };

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ticket?: string }>;
}) {
  const access = await requireCurrentAccess("ticket.submit");
  const [search, options] = await Promise.all([searchParams, listNewTicketFormOptions(access)]);
  return (
    <section className="view" aria-labelledby="new-ticket-title">
      <PageHeader
        backHref="/"
        backLabel="Overview"
        className="narrow-header"
        eyebrow="New request"
        lead="Use everyday language. We will work out the technical details."
        title="Tell us what you need."
        titleId="new-ticket-title"
      />
      <NewTicketForm options={options} search={search} />
    </section>
  );
}
