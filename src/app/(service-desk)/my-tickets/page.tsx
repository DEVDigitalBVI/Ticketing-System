import type { Metadata } from "next";

import { PageHeader } from "@/modules/service-desk/components/page-header";
import { TicketFilters } from "@/modules/service-desk/components/ticket-filters";
import { requireCurrentAccess } from "@/server/auth/authorization";
import { isDatabaseUnavailableError } from "@/server/database/errors";
import { listRequesterTicketWorkspace } from "@/server/tickets/requester-portal";

export const metadata: Metadata = { title: "My tickets" };

export default async function MyTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    q?: string;
    page?: string;
    ticket?: string;
    status?: string;
    attachment?: string;
  }>;
}) {
  const access = await requireCurrentAccess("ticket.read.own");
  const search = await searchParams;
  let workspace;

  try {
    workspace = await listRequesterTicketWorkspace(access, search);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
  }

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
      <TicketFilters workspace={workspace} search={search} />
    </section>
  );
}
