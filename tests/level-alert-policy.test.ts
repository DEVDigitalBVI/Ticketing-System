import { describe, expect, it } from "vitest";

import {
  levelAlertCorrelationKey,
  levelAlertRuleInputSchema,
  isResolveBeforeActive,
  isWithinAlertWindow,
  mayAutoResolve,
  renderLevelAlertTemplate,
  ruleMatchesAlert,
} from "@/server/integrations/level/alert-policy";
import type { LevelAlertContext } from "@/server/integrations/level/webhook-policy";

const alert: LevelAlertContext = {
  id: "alert-1",
  deviceId: "device-1",
  deviceName: "Front Desk 01",
  name: "Low disk space",
  description: "Disk free space is below threshold",
  payload: "4.3% remaining",
  severity: "critical",
  isResolved: false,
  startedAt: new Date("2026-09-08T15:00:00.000Z"),
  resolvedAt: null,
};

describe("Step 24 Level alert policy", () => {
  it("correlates an alert storm to one deterministic incident key", () => {
    const keys = Array.from({ length: 500 }, (_, index) =>
      levelAlertCorrelationKey({
        organizationId: "org-1",
        alertId: alert.id,
        deviceId: alert.deviceId,
        ruleId: "rule-1",
        occurredAt: new Date(alert.startedAt.getTime() + index * 1_000),
        windowMinutes: 60,
      }),
    );
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is retry deterministic and separates devices and time windows", () => {
    const input = {
      organizationId: "org-1",
      alertId: alert.id,
      deviceId: alert.deviceId,
      ruleId: "rule-1",
      occurredAt: alert.startedAt,
      windowMinutes: 60,
    };
    expect(levelAlertCorrelationKey(input)).toBe(levelAlertCorrelationKey(input));
    expect(levelAlertCorrelationKey({ ...input, deviceId: "replacement-device" })).not.toBe(
      levelAlertCorrelationKey(input),
    );
    expect(
      levelAlertCorrelationKey({ ...input, occurredAt: new Date("2026-09-08T17:00:00.000Z") }),
    ).not.toBe(levelAlertCorrelationKey(input));
  });

  it("rejects disabled, wrong-severity, and wrong-property rules", () => {
    const base = {
      isEnabled: true,
      propertyId: "property-1",
      matchNameContains: "disk",
      matchSeverities: ["critical"] as LevelAlertContext["severity"][],
    };
    expect(ruleMatchesAlert(base, alert, "property-1")).toBe(true);
    expect(ruleMatchesAlert({ ...base, isEnabled: false }, alert, "property-1")).toBe(false);
    expect(ruleMatchesAlert({ ...base, matchSeverities: ["warning"] }, alert, "property-1")).toBe(
      false,
    );
    expect(ruleMatchesAlert(base, alert, "property-2")).toBe(false);
  });

  it("uses only controlled template placeholders", () => {
    const rendered = renderLevelAlertTemplate("{{alert.name}} on {{asset.tag}} {{network.raw}}", {
      alert,
      device: { name: alert.deviceName, id: alert.deviceId },
      asset: { tag: "PIR-100", name: "Front desk workstation" },
      property: { name: "Peter Island" },
      location: { name: "Front Desk" },
    });
    expect(rendered).toBe("Low disk space on PIR-100 [unsupported:network.raw]");
  });

  it("never auto-resolves ongoing human work", () => {
    expect(mayAutoResolve("if_unstarted", { status: "new", startedAt: null })).toBe(true);
    expect(mayAutoResolve("if_unstarted", { status: "in_progress", startedAt: new Date() })).toBe(
      false,
    );
    expect(mayAutoResolve("never", { status: "new", startedAt: null })).toBe(false);
  });

  it("suppresses flapping only inside the configured window", () => {
    const resolvedAt = new Date("2026-09-08T15:00:00.000Z");
    expect(isWithinAlertWindow(resolvedAt, new Date("2026-09-08T15:14:59.000Z"), 15)).toBe(true);
    expect(isWithinAlertWindow(resolvedAt, new Date("2026-09-08T15:15:01.000Z"), 15)).toBe(false);
    expect(isWithinAlertWindow(resolvedAt, new Date("2026-09-08T15:01:00.000Z"), 0)).toBe(false);
  });

  it("identifies resolve-before-active ordering", () => {
    expect(isResolveBeforeActive(null, new Date("2026-09-08T15:00:00.000Z"))).toBe(true);
    expect(
      isResolveBeforeActive(
        new Date("2026-09-08T15:01:00.000Z"),
        new Date("2026-09-08T15:00:00.000Z"),
      ),
    ).toBe(true);
    expect(
      isResolveBeforeActive(
        new Date("2026-09-08T14:59:00.000Z"),
        new Date("2026-09-08T15:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("validates controlled severity-to-priority mappings", () => {
    const parsed = levelAlertRuleInputSchema.parse({
      name: "Critical device alerts",
      isEnabled: true,
      dryRun: false,
      sortOrder: 10,
      propertyId: null,
      requesterUserId: "11111111-1111-4111-8111-111111111111",
      categoryId: "22222222-2222-4222-8222-222222222222",
      subcategoryId: null,
      supportTeamId: null,
      matchNameContains: null,
      matchSeverities: ["critical", "emergency"],
      severityPriorityMap: { information: "P4", warning: "P3", critical: "P2", emergency: "P1" },
      subjectTemplate: "{{alert.name}}",
      descriptionTemplate: "{{alert.description}}",
      correlationWindowMinutes: 60,
      suppressionWindowMinutes: 15,
      autoResolvePolicy: "never",
    });
    expect(parsed.severityPriorityMap.emergency).toBe("P1");
    expect(parsed.severityPriorityMap.critical).toBe("P2");
  });
});
