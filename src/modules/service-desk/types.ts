type StaffTicketStatus = "Waiting for IT" | "Needs your reply" | "In progress";

export type StaffTicket = {
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
