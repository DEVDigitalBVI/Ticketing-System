import type { Metadata } from "next";

import { TechnicianWorkspace } from "@/modules/service-desk/components/technician-workspace";

export const metadata: Metadata = { title: "Technician workspace" };

export default function TechnicianPage() {
  return <TechnicianWorkspace />;
}
