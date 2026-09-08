import type { Metadata } from "next";

import { NewTicketForm } from "@/modules/service-desk/components/new-ticket-form";
import { PageHeader } from "@/modules/service-desk/components/page-header";
import { requireCurrentAccess } from "@/server/auth/authorization";
import { isDatabaseUnavailableError } from "@/server/database/errors";
import { listNewTicketFormOptions } from "@/server/tickets/intake";

export const metadata: Metadata = { title: "Report an issue" };

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ticket?: string }>;
}) {
  const access = await requireCurrentAccess("ticket.submit");
  const search = await searchParams;
  let options;

  try {
    options = await listNewTicketFormOptions(access);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
  }

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
      {options?.properties.length && options.categories.length ? (
        <NewTicketForm options={options} search={search} />
      ) : (
        <div className="empty-state">
          <strong>Ticket submission is temporarily unavailable</strong>
          <p>
            The service desk could not load an active property and category. Ask IT to verify the
            database connection and service configuration.
          </p>
        </div>
      )}
    </section>
  );
}
