import type { Metadata } from "next";

import { TechnicianWorkspace } from "@/modules/service-desk/components/technician-workspace";
import { requireCurrentAccess } from "@/server/auth/authorization";
import { isDatabaseUnavailableError } from "@/server/database/errors";
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
  let workspace;

  try {
    workspace = await listTechnicianWorkspace(access, search);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
  }

  return <TechnicianWorkspace workspace={workspace} search={{ status: search.status }} />;
}
