import { ServiceDeskShell } from "@/modules/service-desk/components/service-desk-shell";

export default function ServiceDeskLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ServiceDeskShell>{children}</ServiceDeskShell>;
}
