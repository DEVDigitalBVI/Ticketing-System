import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import {
  TechnicianWorkspace,
  TechnicianWorkspaceFromQuery,
} from "@/modules/service-desk/components/technician-workspace";
import { getCurrentAccess } from "@/server/auth/access";

export const metadata: Metadata = { title: "Technician workspace" };

export default async function TechnicianPage() {
  const access = await getCurrentAccess();
  if (!access?.roles.some((role) => role === "technician" || role === "admin")) redirect("/");
  return (
    <Suspense fallback={<TechnicianWorkspace />}>
      <TechnicianWorkspaceFromQuery />
    </Suspense>
  );
}
