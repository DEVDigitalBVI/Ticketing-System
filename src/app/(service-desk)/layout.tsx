import { ServiceDeskShell } from "@/modules/service-desk/components/service-desk-shell";
import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/server/auth/access";

export default async function ServiceDeskLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const access = await getCurrentAccess();
  if (!access) redirect("/login");
  if (access.mustChangePassword) redirect("/account/change-password");
  return <ServiceDeskShell access={access}>{children}</ServiceDeskShell>;
}
