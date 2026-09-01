type StaffTicketStatus =
  | "Waiting for IT"
  | "Needs your reply"
  | "Ready for confirmation"
  | "Completed";

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

export type TechnicianTicket = {
  key: string;
  id: string;
  priority: "P1" | "P2";
  title: string;
  age: string;
  location: string;
  impact: string;
  owner: string;
  ownerInitials: string;
  sla: string;
  slaState: "danger" | "warning" | "normal";
  requester: string;
  lastUpdate: string;
  device: string;
  affected: string;
  alerts: string;
};
