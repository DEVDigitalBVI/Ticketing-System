import type { Metadata } from "next";

import { NewTicketForm } from "@/modules/service-desk/components/new-ticket-form";
import { PageHeader } from "@/modules/service-desk/components/page-header";
import { requireCurrentAccess } from "@/server/auth/authorization";

export const metadata: Metadata = { title: "Report an issue" };

export default async function NewTicketPage() {
  await requireCurrentAccess("ticket.submit");
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
      <NewTicketForm />
    </section>
  );
}
