import type { Metadata } from "next";
import { Suspense } from "react";

import {
  TechnicianWorkspace,
  TechnicianWorkspaceFromQuery,
} from "@/modules/service-desk/components/technician-workspace";

export const metadata: Metadata = { title: "Technician workspace" };

export default function TechnicianPage() {
  return (
    <Suspense fallback={<TechnicianWorkspace />}>
      <TechnicianWorkspaceFromQuery />
    </Suspense>
  );
}
