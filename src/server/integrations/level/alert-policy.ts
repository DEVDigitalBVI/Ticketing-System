import { createHash } from "node:crypto";

import { z } from "zod";

import type { LevelAlertContext } from "./webhook-policy";

export const levelAlertSeverities = ["information", "warning", "critical", "emergency"] as const;
export const levelAlertPriorities = ["P1", "P2", "P3", "P4"] as const;
export const levelAlertAutoResolvePolicies = ["never", "if_unstarted"] as const;

export const levelAlertRuleInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(3).max(120),
  isEnabled: z.boolean(),
  dryRun: z.boolean(),
  sortOrder: z.number().int().min(0).max(10_000),
  propertyId: z.string().uuid().nullable(),
  requesterUserId: z.string().uuid(),
  categoryId: z.string().uuid(),
  subcategoryId: z.string().uuid().nullable(),
  supportTeamId: z.string().uuid().nullable(),
  matchNameContains: z.string().trim().min(2).max(120).nullable(),
  matchSeverities: z.array(z.enum(levelAlertSeverities)).min(1),
  severityPriorityMap: z.object({
    information: z.enum(levelAlertPriorities),
    warning: z.enum(levelAlertPriorities),
    critical: z.enum(levelAlertPriorities),
    emergency: z.enum(levelAlertPriorities),
  }),
  subjectTemplate: z.string().trim().min(3).max(180),
  descriptionTemplate: z.string().trim().min(3).max(4000),
  correlationWindowMinutes: z.number().int().min(1).max(10_080),
  suppressionWindowMinutes: z.number().int().min(0).max(10_080),
  autoResolvePolicy: z.enum(levelAlertAutoResolvePolicies),
});

export type LevelAlertRuleInput = z.infer<typeof levelAlertRuleInputSchema>;

export type AlertTemplateContext = {
  alert: LevelAlertContext;
  device: { name: string; id: string };
  asset: { tag: string; name: string };
  property: { name: string };
  location: { name: string | null };
};

const placeholders: Record<string, (context: AlertTemplateContext) => string> = {
  "alert.name": (c) => c.alert.name,
  "alert.description": (c) => c.alert.description,
  "alert.payload": (c) => c.alert.payload ?? "Not reported",
  "alert.severity": (c) => c.alert.severity,
  "alert.startedAt": (c) => c.alert.startedAt.toISOString(),
  "device.name": (c) => c.device.name,
  "device.id": (c) => c.device.id,
  "asset.tag": (c) => c.asset.tag,
  "asset.name": (c) => c.asset.name,
  "property.name": (c) => c.property.name,
  "location.name": (c) => c.location.name ?? "Not assigned",
};

export function renderLevelAlertTemplate(template: string, context: AlertTemplateContext) {
  return template.replace(/\{\{\s*([a-zA-Z.]+)\s*\}\}/g, (_match, key: string) => {
    const value = placeholders[key];
    return value ? value(context) : `[unsupported:${key}]`;
  });
}

export function ruleMatchesAlert(
  rule: Pick<
    LevelAlertRuleInput,
    "isEnabled" | "propertyId" | "matchNameContains" | "matchSeverities"
  >,
  alert: LevelAlertContext,
  propertyId: string,
) {
  return (
    rule.isEnabled &&
    (!rule.propertyId || rule.propertyId === propertyId) &&
    rule.matchSeverities.includes(alert.severity) &&
    (!rule.matchNameContains ||
      alert.name.toLocaleLowerCase().includes(rule.matchNameContains.toLocaleLowerCase()))
  );
}

export function levelAlertCorrelationKey(input: {
  organizationId: string;
  alertId: string;
  deviceId: string;
  ruleId: string;
  occurredAt: Date;
  windowMinutes: number;
}) {
  const windowMs = input.windowMinutes * 60_000;
  const bucket = Math.floor(input.occurredAt.getTime() / windowMs);
  return createHash("sha256")
    .update(`${input.organizationId}|${input.alertId}|${input.deviceId}|${input.ruleId}|${bucket}`)
    .digest("hex");
}

export function impactUrgencyForPriority(priority: (typeof levelAlertPriorities)[number]) {
  return {
    impact:
      priority === "P1"
        ? "critical"
        : priority === "P2"
          ? "high"
          : priority === "P3"
            ? "medium"
            : "low",
    urgency:
      priority === "P1"
        ? "critical"
        : priority === "P2"
          ? "high"
          : priority === "P3"
            ? "medium"
            : "low",
  } as const;
}

export function mayAutoResolve(
  policy: (typeof levelAlertAutoResolvePolicies)[number],
  ticket: { status: string; startedAt: Date | null },
) {
  return (
    policy === "if_unstarted" &&
    ticket.startedAt === null &&
    ["new", "triage", "assigned"].includes(ticket.status)
  );
}

export function isWithinAlertWindow(earlier: Date | null, later: Date, windowMinutes: number) {
  return (
    earlier !== null &&
    windowMinutes > 0 &&
    earlier <= later &&
    earlier.getTime() >= later.getTime() - windowMinutes * 60_000
  );
}

export function isResolveBeforeActive(firstActiveAt: Date | null, resolvedAt: Date) {
  return firstActiveAt === null || resolvedAt < firstActiveAt;
}
