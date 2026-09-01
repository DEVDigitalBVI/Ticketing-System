import type { Metadata } from "next";
import { Suspense } from "react";

import {
  TechnicianWorkspace,
  TechnicianWorkspaceFromQuery,
} from "@/modules/service-desk/components/technician-workspace";
import { requireCurrentAccess } from "@/server/auth/authorization";

export const metadata: Metadata = { title: "Technician workspace" };

export default async function TechnicianPage() {
  await requireCurrentAccess("ticket.queue.read");
  return (
    <Suspense fallback={<TechnicianWorkspace />}>
      <TechnicianWorkspaceFromQuery />
    </Suspense>
  );
}
