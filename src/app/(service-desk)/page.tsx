import { StaffOverview } from "@/modules/service-desk/components/staff-overview";
import { requireCurrentAccess } from "@/server/auth/authorization";
import { isDatabaseUnavailableError } from "@/server/database/errors";
import { readStaffOverview } from "@/server/tickets/requester-portal";

export default async function HomePage() {
  const access = await requireCurrentAccess("ticket.read.own");
  let overview;
  try {
    overview = await readStaffOverview(access);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
  }
  return <StaffOverview overview={overview} />;
}
