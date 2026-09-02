import { describe, expect, it } from "vitest";

import {
  addSupportMinutes,
  calculateReopenSla,
  calculateSlaDeadlines,
  defaultSlaPolicy,
  evaluateSla,
  priorityFor,
  resumeDeadline,
  snapshotSlaPolicy,
  type SlaPolicySnapshot,
} from "@/server/sla/policy";

function policy(overrides: Partial<SlaPolicySnapshot> = {}): SlaPolicySnapshot {
  return {
    ...defaultSlaPolicy,
    policyId: "policy-test",
    supportHours: {
      sunday: [],
      monday: [{ start: "08:00", end: "17:00" }],
      tuesday: [{ start: "08:00", end: "17:00" }],
      wednesday: [{ start: "08:00", end: "17:00" }],
      thursday: [{ start: "08:00", end: "17:00" }],
      friday: [{ start: "08:00", end: "17:00" }],
      saturday: [],
    },
    ...overrides,
  };
}

describe("versioned SLA policy", () => {
  it("calculates every approved impact and urgency combination from configuration", () => {
    const configured = policy();
    expect(priorityFor(configured, "critical", "critical")).toBe("P1");
    expect(priorityFor(configured, "high", "medium")).toBe("P2");
    expect(priorityFor(configured, "medium", "medium")).toBe("P3");
    expect(priorityFor(configured, "low", "low")).toBe("P4");
  });

  it("uses the policy timezone, never the process timezone", () => {
    const tortola = policy({ timezone: "America/Tortola" });
    const start = new Date("2026-09-07T12:00:00.000Z");
    expect(addSupportMinutes(start, 60, tortola).toISOString()).toBe("2026-09-07T13:00:00.000Z");

    const newYork = policy({ timezone: "America/New_York" });
    expect(addSupportMinutes(new Date("2026-11-02T13:00:00.000Z"), 60, newYork).toISOString()).toBe(
      "2026-11-02T14:00:00.000Z",
    );
  });

  it("skips after-hours time, weekends, and configured holidays exactly", () => {
    const configured = policy({ holidays: ["2026-09-07"] });
    const fridayAtClose = new Date("2026-09-04T20:30:00.000Z");
    expect(addSupportMinutes(fridayAtClose, 60, configured).toISOString()).toBe(
      "2026-09-08T12:30:00.000Z",
    );
  });

  it("preserves seconds across an exact support-window boundary", () => {
    const start = new Date("2026-09-04T20:30:30.000Z");
    expect(addSupportMinutes(start, 30, policy()).toISOString()).toBe("2026-09-07T12:00:30.000Z");
  });

  it("continues on the next support day without skipping weekdays", () => {
    const monday = new Date("2026-09-07T20:30:00.000Z");
    expect(addSupportMinutes(monday, 60, policy()).toISOString()).toBe("2026-09-08T12:30:00.000Z");
  });

  it("freezes remaining support time while a ticket is waiting and resumes deterministically", () => {
    const configured = policy();
    const pausedAt = new Date("2026-09-07T14:00:00.000Z");
    const originalDue = new Date("2026-09-07T16:00:00.000Z");
    const resumedAt = new Date("2026-09-08T15:30:00.000Z");
    expect(resumeDeadline(pausedAt, resumedAt, originalDue, configured)?.toISOString()).toBe(
      "2026-09-08T17:30:00.000Z",
    );
  });

  it("keeps a ticket snapshot stable after a later policy version changes", () => {
    const v1 = snapshotSlaPolicy({
      ...policy(),
      id: "stored-policy",
      responseTargets: { P1: 15, P2: 30, P3: 60, P4: 120 },
    });
    const v2 = { ...v1, version: 2, responseTargets: { ...v1.responseTargets, P3: 30 } };
    const start = new Date("2026-09-07T12:00:00.000Z");
    expect(calculateSlaDeadlines(start, "P3", v1).responseDueAt.toISOString()).toBe(
      "2026-09-07T13:00:00.000Z",
    );
    expect(calculateSlaDeadlines(start, "P3", v2).responseDueAt.toISOString()).toBe(
      "2026-09-07T12:30:00.000Z",
    );
  });

  it("applies configured reset and preserve behavior on reopen", () => {
    const reopenedAt = new Date("2026-09-08T12:00:00.000Z");
    const oldResponse = new Date("2026-09-07T13:00:00.000Z");
    const oldResolution = new Date("2026-09-07T16:00:00.000Z");
    const reset = calculateReopenSla(reopenedAt, "P3", policy(), {
      responseDueAt: oldResponse,
      respondedAt: oldResponse,
      resolutionDueAt: oldResolution,
    });
    expect(reset.respondedAt).toBeNull();
    expect(reset.responseDueAt?.toISOString()).toBe("2026-09-08T14:00:00.000Z");

    const preserve = calculateReopenSla(
      reopenedAt,
      "P3",
      policy({ reopenBehavior: { response: "preserve", resolution: "preserve" } }),
      { responseDueAt: oldResponse, respondedAt: oldResponse, resolutionDueAt: oldResolution },
    );
    expect(preserve).toEqual({
      responseDueAt: oldResponse,
      respondedAt: oldResponse,
      resolutionDueAt: oldResolution,
    });
  });

  it("marks warning and breach boundaries exactly with a supplied clock", () => {
    const configured = policy({ warningMinutes: 30 });
    const due = new Date("2026-09-07T15:00:00.000Z");
    const base = {
      status: "in_progress" as const,
      policy: configured,
      responseDueAt: due,
      respondedAt: null,
      resolutionDueAt: null,
      resolvedAt: null,
    };
    expect(evaluateSla({ ...base, now: new Date("2026-09-07T14:29:59.999Z") }).response).toBe(
      "on_track",
    );
    expect(evaluateSla({ ...base, now: new Date("2026-09-07T14:30:00.000Z") }).response).toBe(
      "at_risk",
    );
    expect(evaluateSla({ ...base, now: new Date("2026-09-07T15:00:00.000Z") }).response).toBe(
      "breached",
    );
    expect(evaluateSla({ ...base, status: "waiting_for_requester", now: due }).response).toBe(
      "paused",
    );
  });

  it("measures warning thresholds in support time across a weekend", () => {
    const configured = policy({ warningMinutes: 30 });
    const due = new Date("2026-09-07T12:15:00.000Z");
    const base = {
      status: "in_progress" as const,
      policy: configured,
      responseDueAt: due,
      respondedAt: null,
      resolutionDueAt: null,
      resolvedAt: null,
    };
    const result = evaluateSla({ ...base, now: new Date("2026-09-04T20:45:00.000Z") });
    expect(result.response).toBe("at_risk");
    expect(result.warningAt?.toISOString()).toBe("2026-09-04T20:45:00.000Z");
  });
});
