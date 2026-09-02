type StaffTicketStatus =
  "Waiting for IT" | "Needs your reply" | "Ready for confirmation" | "Completed";

export type StaffTicket = {
  ticketId: string;
  id: string;
  type: string;
  title: string;
  location: string;
  updated: string;
  day: string;
  month: string;
  priority: "high" | "normal";
  status: StaffTicketStatus;
  state: "active" | "completed";
  canonicalStatus: string;
};
