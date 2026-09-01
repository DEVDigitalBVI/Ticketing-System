import type { Metadata } from "next";

import { TechnicianWorkspace } from "@/modules/service-desk/components/technician-workspace";
import { requireCurrentAccess } from "@/server/auth/authorization";
import { listTechnicianWorkspace } from "@/server/tickets/technician-queue";

export const metadata: Metadata = { title: "Technician workspace" };

export default async function TechnicianPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    page?: string;
    ticket?: string;
    status?: string;
  }>;
}) {
  const access = await requireCurrentAccess("ticket.queue.read");
  const search = await searchParams;
  const workspace = await listTechnicianWorkspace(access, search);

  return <TechnicianWorkspace workspace={workspace} search={{ status: search.status }} />;
}
