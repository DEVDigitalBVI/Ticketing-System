import type { Metadata } from "next";

import { PageHeader } from "@/modules/service-desk/components/page-header";
import { TicketFilters } from "@/modules/service-desk/components/ticket-filters";
import { requireCurrentAccess } from "@/server/auth/authorization";

export const metadata: Metadata = { title: "My tickets" };

export default async function MyTicketsPage() {
  await requireCurrentAccess("ticket.read.own");
  return (
    <section className="view" aria-labelledby="tickets-title">
      <PageHeader
        actionHref="/new-ticket"
        actionLabel="New ticket"
        eyebrow="Staff portal"
        lead="Follow progress and reply when IT needs more information."
        title="My tickets"
        titleId="tickets-title"
      />
      <TicketFilters />
    </section>
  );
}
