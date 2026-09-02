import { z } from "zod";

import {
  ticketImpactValues,
  ticketPriorityValues,
  ticketStatuses,
  ticketUrgencyValues,
  type TicketImpact,
  type TicketPriority,
  type TicketStatus,
  type TicketUrgency,
} from "@/server/tickets/workflow";

const dayValues = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
type Weekday = (typeof dayValues)[number];

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const supportWindowSchema = z.object({
  start: z.string().regex(timePattern),
  end: z.string().regex(timePattern),
});
const targetsSchema = z.object({ P1: z.number().int().positive(), P2: z.number().int().positive(), P3: z.number().int().positive(), P4: z.number().int().positive() });
const ruleRowSchema = z.object({ low: z.enum(ticketPriorityValues), medium: z.enum(ticketPriorityValues), high: z.enum(ticketPriorityValues), critical: z.enum(ticketPriorityValues) });

export const slaPolicySnapshotSchema = z.object({
  policyId: z.string(),
  version: z.number().int().positive(),
  name: z.string().min(1),
  timezone: z.string().min(1),
  supportHours: z.object({
    sunday: z.array(supportWindowSchema), monday: z.array(supportWindowSchema),
    tuesday: z.array(supportWindowSchema), wednesday: z.array(supportWindowSchema),
    thursday: z.array(supportWindowSchema), friday: z.array(supportWindowSchema),
    saturday: z.array(supportWindowSchema),
  }),
  holidays: z.array(z.string().date()),
  impactUrgencyRules: z.object({ low: ruleRowSchema, medium: ruleRowSchema, high: ruleRowSchema, critical: ruleRowSchema }),
  warningMinutes: z.number().int().nonnegative(),
  pauseStatuses: z.array(z.enum(ticketStatuses)),
  reopenBehavior: z.object({ response: z.enum(["reset", "preserve"]), resolution: z.enum(["reset", "preserve"]) }),
  responseTargets: targetsSchema,
  resolutionTargets: targetsSchema,
});

export type SlaPolicySnapshot = z.infer<typeof slaPolicySnapshotSchema>;

export const defaultSlaPolicy: SlaPolicySnapshot = {
  policyId: "default-peter-island-sla",
  version: 1,
  name: "Peter Island standard support",
  timezone: "America/Tortola",
  supportHours: {
    sunday: [], monday: [{ start: "08:00", end: "17:00" }],
    tuesday: [{ start: "08:00", end: "17:00" }], wednesday: [{ start: "08:00", end: "17:00" }],
    thursday: [{ start: "08:00", end: "17:00" }], friday: [{ start: "08:00", end: "17:00" }], saturday: [],
  },
  holidays: [],
  impactUrgencyRules: {
    low: { low: "P4", medium: "P4", high: "P3", critical: "P2" },
    medium: { low: "P4", medium: "P3", high: "P2", critical: "P2" },
    high: { low: "P3", medium: "P2", high: "P2", critical: "P1" },
    critical: { low: "P2", medium: "P2", high: "P1", critical: "P1" },
  },
  warningMinutes: 30,
  pauseStatuses: ["waiting_for_requester", "waiting_for_vendor"],
  reopenBehavior: { response: "reset", resolution: "reset" },
  responseTargets: { P1: 15, P2: 30, P3: 120, P4: 240 },
  resolutionTargets: { P1: 120, P2: 240, P3: 480, P4: 960 },
};

export type StoredSlaPolicy = {
  id: string; version: number; name: string; timezone: string; supportHours: unknown;
  holidays: unknown; impactUrgencyRules: unknown; warningMinutes: number; pauseStatuses: unknown;
  reopenBehavior: unknown; responseTargets: unknown; resolutionTargets: unknown;
};

export function snapshotSlaPolicy(policy: StoredSlaPolicy | null | undefined): SlaPolicySnapshot {
  if (!policy) return defaultSlaPolicy;
  return slaPolicySnapshotSchema.parse({
    policyId: policy.id, version: policy.version, name: policy.name, timezone: policy.timezone,
    supportHours: policy.supportHours, holidays: policy.holidays,
    impactUrgencyRules: policy.impactUrgencyRules, warningMinutes: policy.warningMinutes,
    pauseStatuses: policy.pauseStatuses, reopenBehavior: policy.reopenBehavior,
    responseTargets: policy.responseTargets, resolutionTargets: policy.resolutionTargets,
  });
}

export function parseSlaPolicySnapshot(value: unknown): SlaPolicySnapshot | null {
  const parsed = slaPolicySnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function priorityFor(policy: SlaPolicySnapshot, impact: TicketImpact, urgency: TicketUrgency): TicketPriority {
  return policy.impactUrgencyRules[impact][urgency];
}

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: Weekday };
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timezone: string) {
  let value = formatterCache.get(timezone);
  if (!value) {
    value = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", weekday: "long", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    formatterCache.set(timezone, value);
  }
  return value;
}

function localParts(instant: Date, timezone: string): LocalParts {
  const parts = Object.fromEntries(formatter(timezone).formatToParts(instant).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second), weekday: parts.weekday.toLowerCase() as Weekday };
}

function localDateKey(parts: Pick<LocalParts, "year" | "month" | "day">) {
  return `${parts.year.toString().padStart(4, "0")}-${parts.month.toString().padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

function utcForLocal(timezone: string, year: number, month: number, day: number, hour: number, minute: number) {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = localParts(new Date(candidate), timezone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    candidate += target - actualAsUtc;
  }
  return new Date(candidate);
}

function addLocalDays(parts: LocalParts, days: number) {
  const value = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

function windowsForDate(policy: SlaPolicySnapshot, date: { year: number; month: number; day: number }) {
  const noon = utcForLocal(policy.timezone, date.year, date.month, date.day, 12, 0);
  const parts = localParts(noon, policy.timezone);
  if (policy.holidays.includes(localDateKey(parts))) return [];
  return policy.supportHours[parts.weekday].map((window) => {
    const [startHour, startMinute] = window.start.split(":").map(Number);
    const [endHour, endMinute] = window.end.split(":").map(Number);
    const start = utcForLocal(policy.timezone, date.year, date.month, date.day, startHour, startMinute);
    const end = utcForLocal(policy.timezone, date.year, date.month, date.day, endHour, endMinute);
    if (end <= start) throw new Error("SLA support windows must end after they start.");
    return { start, end };
  }).sort((left, right) => left.start.getTime() - right.start.getTime());
}

export function addSupportMilliseconds(start: Date, durationMs: number, policy: SlaPolicySnapshot): Date {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(durationMs) || durationMs < 0) throw new Error("Invalid SLA time input.");
  let remaining = durationMs;
  let cursor = new Date(start);
  for (let dayOffset = 0; dayOffset < 3700; dayOffset += 1) {
    const local = localParts(cursor, policy.timezone);
    const date = dayOffset === 0 ? local : { ...local, ...addLocalDays(local, 1) };
    for (const window of windowsForDate(policy, date)) {
      if (cursor >= window.end) continue;
      if (cursor < window.start) cursor = window.start;
      const available = window.end.getTime() - cursor.getTime();
      if (remaining <= available) return new Date(cursor.getTime() + remaining);
      remaining -= available;
      cursor = window.end;
    }
    const next = addLocalDays(localParts(cursor, policy.timezone), 1);
    cursor = utcForLocal(policy.timezone, next.year, next.month, next.day, 0, 0);
  }
  throw new Error("SLA policy has no reachable support time.");
}

export function addSupportMinutes(start: Date, minutes: number, policy: SlaPolicySnapshot) {
  return addSupportMilliseconds(start, minutes * 60_000, policy);
}

export function supportMillisecondsBetween(start: Date, end: Date, policy: SlaPolicySnapshot) {
  if (end <= start) return 0;
  let total = 0;
  let cursor = new Date(start);
  for (let day = 0; day < 3700 && cursor < end; day += 1) {
    const local = localParts(cursor, policy.timezone);
    for (const window of windowsForDate(policy, local)) {
      const overlapStart = Math.max(cursor.getTime(), window.start.getTime());
      const overlapEnd = Math.min(end.getTime(), window.end.getTime());
      if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
    }
    const next = addLocalDays(local, 1);
    cursor = utcForLocal(policy.timezone, next.year, next.month, next.day, 0, 0);
  }
  return total;
}

export function calculateSlaDeadlines(start: Date, priority: TicketPriority, policy: SlaPolicySnapshot) {
  return { responseDueAt: addSupportMinutes(start, policy.responseTargets[priority], policy), resolutionDueAt: addSupportMinutes(start, policy.resolutionTargets[priority], policy) };
}

export type SlaState = "not_applicable" | "on_track" | "at_risk" | "breached" | "paused" | "met";
export type SlaEvaluation = { overall: SlaState; response: SlaState; resolution: SlaState; nextDeadline: Date | null; warningAt: Date | null };

function clockState(now: Date, dueAt: Date | null, metAt: Date | null, warningMinutes: number, paused: boolean): SlaState {
  if (!dueAt) return "not_applicable";
  if (metAt) return metAt <= dueAt ? "met" : "breached";
  if (paused) return "paused";
  if (now >= dueAt) return "breached";
  return dueAt.getTime() - now.getTime() <= warningMinutes * 60_000 ? "at_risk" : "on_track";
}

export function evaluateSla(input: { now: Date; status: TicketStatus; policy: SlaPolicySnapshot | null; responseDueAt: Date | null; respondedAt: Date | null; resolutionDueAt: Date | null; resolvedAt: Date | null }): SlaEvaluation {
  if (!input.policy) return { overall: "not_applicable", response: "not_applicable", resolution: "not_applicable", nextDeadline: null, warningAt: null };
  const paused = input.policy.pauseStatuses.includes(input.status);
  const complete = ["closed", "cancelled"].includes(input.status);
  const response = clockState(input.now, input.responseDueAt, input.respondedAt, input.policy.warningMinutes, paused || complete);
  const resolution = clockState(input.now, input.resolutionDueAt, input.resolvedAt, input.policy.warningMinutes, paused || complete);
  const rank: Record<SlaState, number> = { breached: 5, at_risk: 4, paused: 3, on_track: 2, met: 1, not_applicable: 0 };
  const overall = rank[response] >= rank[resolution] ? response : resolution;
  const pending = [[response, input.responseDueAt], [resolution, input.resolutionDueAt]].filter(([state]) => state === "on_track" || state === "at_risk").map(([, due]) => due as Date).sort((a, b) => a.getTime() - b.getTime());
  const nextDeadline = pending[0] ?? null;
  return { overall, response, resolution, nextDeadline, warningAt: nextDeadline ? new Date(nextDeadline.getTime() - input.policy.warningMinutes * 60_000) : null };
}

export function resumeDeadline(pausedAt: Date, resumedAt: Date, dueAt: Date | null, policy: SlaPolicySnapshot) {
  if (!dueAt || pausedAt >= dueAt) return dueAt;
  const remaining = supportMillisecondsBetween(pausedAt, dueAt, policy);
  return addSupportMilliseconds(resumedAt, remaining, policy);
}

export function isTicketImpact(value: string): value is TicketImpact { return (ticketImpactValues as readonly string[]).includes(value); }
export function isTicketUrgency(value: string): value is TicketUrgency { return (ticketUrgencyValues as readonly string[]).includes(value); }
