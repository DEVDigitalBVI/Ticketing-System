import { describe, expect, it } from "vitest";

import type { AuthorizationSubject } from "@/modules/auth/authorization";
import {
  calculatePriorityPlaceholder,
  canAddComment,
  canReadTicket,
  canTransitionStatus,
  ticketStatuses,
  validTicketTransitions,
} from "@/server/tickets/workflow";

const ids = {
  organization: "org-1",
  property: "property-1",
  otherProperty: "property-2",
  requester: "user-1",
  otherUser: "user-2",
  department: "department-1",
};

function subject(
  roles: AuthorizationSubject["roles"],
  userId = ids.requester,
  propertyIds = [ids.property],
): AuthorizationSubject {
  return {
    userId,
    organizationId: ids.organization,
    propertyIds,
    departmentIds: [ids.department],
    roles,
  };
}

const ticket = {
  organizationId: ids.organization,
  propertyId: ids.property,
  requesterUserId: ids.requester,
  departmentId: ids.department,
};

describe("ticket workflow", () => {
  it("proves every allowed and denied lifecycle transition", () => {
    for (const fromStatus of ticketStatuses) {
      for (const toStatus of ticketStatuses) {
        const expected = validTicketTransitions[fromStatus].includes(toStatus);
        expect(canTransitionStatus(fromStatus, toStatus), `${fromStatus} -> ${toStatus}`).toBe(
          expected,
        );
      }
    }
  });

  it("calculates the placeholder priority matrix", () => {
    expect(calculatePriorityPlaceholder("critical", "critical")).toBe("P1");
    expect(calculatePriorityPlaceholder("high", "medium")).toBe("P2");
    expect(calculatePriorityPlaceholder("medium", "low")).toBe("P3");
    expect(calculatePriorityPlaceholder("low", "low")).toBe("P4");
  });

  it("lets requesters read and comment on their own tickets but not add internal notes", () => {
    const requester = subject(["requester"]);
    expect(canReadTicket(requester, ticket)).toBe(true);
    expect(canAddComment(requester, ticket, "requester")).toBe(true);
    expect(canAddComment(requester, ticket, "internal")).toBe(false);
  });

  it("lets queue staff read and add internal notes within scope only", () => {
    const technician = subject(["technician"], ids.otherUser);
    expect(canReadTicket(technician, ticket)).toBe(true);
    expect(canAddComment(technician, ticket, "internal")).toBe(true);
    expect(canReadTicket(subject(["technician"], ids.otherUser, [ids.otherProperty]), ticket)).toBe(
      false,
    );
  });
});
