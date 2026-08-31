import type { Metadata } from "next";

import { PageHeader } from "@/modules/service-desk/components/page-header";
import { TicketFilters } from "@/modules/service-desk/components/ticket-filters";

export const metadata: Metadata = { title: "My tickets" };

export default function MyTicketsPage() {
  return (
    <section className="view view-visible" aria-labelledby="tickets-title">
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
