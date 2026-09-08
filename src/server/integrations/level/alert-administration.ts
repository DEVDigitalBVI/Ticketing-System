import "server-only";

import type { AccessProfile } from "@/server/auth/access";
import { accessCan } from "@/server/auth/authorization";
import { database } from "@/server/database/client";
import { levelAlertRuleInputSchema } from "@/server/integrations/level/alert-policy";
import { AuditEventRepository } from "@/server/repositories/audit-event-repository";

function assertAdministrator(access: AccessProfile) {
  if (!accessCan(access, "configuration.manage")) throw new Error("Access denied.");
}

export async function readLevelAlertRuleAdministration(access: AccessProfile) {
  assertAdministrator(access);
  const organizationId = access.organizationId;
  const [rules, properties, users, categories, subcategories, supportTeams, decisions] =
    await Promise.all([
      database.levelAlertRule.findMany({
        where: { organizationId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      database.property.findMany({
        where: { organizationId, isActive: true },
        orderBy: { name: "asc" },
      }),
      database.user.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, displayName: true },
        orderBy: { displayName: "asc" },
      }),
      database.ticketCategory.findMany({
        where: { organizationId, isActive: true },
        orderBy: { name: "asc" },
      }),
      database.ticketSubcategory.findMany({
        where: { organizationId, isActive: true },
        orderBy: { name: "asc" },
      }),
      database.supportTeam.findMany({
        where: { organizationId, isActive: true },
        orderBy: { name: "asc" },
      }),
      database.levelAlertDecision.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);
  return { rules, properties, users, categories, subcategories, supportTeams, decisions };
}

export async function saveLevelAlertRule(
  access: AccessProfile,
  raw: unknown,
  correlationId: string,
) {
  assertAdministrator(access);
  const rule = levelAlertRuleInputSchema.parse(raw);
  return database.$transaction(async (tx) => {
    const [requester, category, property, subcategory, team] = await Promise.all([
      tx.user.findFirst({
        where: { id: rule.requesterUserId, organizationId: access.organizationId, isActive: true },
      }),
      tx.ticketCategory.findFirst({
        where: { id: rule.categoryId, organizationId: access.organizationId, isActive: true },
      }),
      rule.propertyId
        ? tx.property.findFirst({
            where: { id: rule.propertyId, organizationId: access.organizationId, isActive: true },
          })
        : null,
      rule.subcategoryId
        ? tx.ticketSubcategory.findFirst({
            where: {
              id: rule.subcategoryId,
              organizationId: access.organizationId,
              categoryId: rule.categoryId,
              isActive: true,
            },
          })
        : null,
      rule.supportTeamId
        ? tx.supportTeam.findFirst({
            where: {
              id: rule.supportTeamId,
              organizationId: access.organizationId,
              propertyId: rule.propertyId ?? "",
              isActive: true,
            },
          })
        : null,
    ]);
    if (
      !requester ||
      !category ||
      (rule.propertyId && !property) ||
      (rule.subcategoryId && !subcategory) ||
      (rule.supportTeamId && !team)
    )
      throw new Error("Invalid Level alert rule relationship.");
    const data = {
      organizationId: access.organizationId,
      name: rule.name,
      isEnabled: rule.isEnabled,
      dryRun: rule.dryRun,
      sortOrder: rule.sortOrder,
      propertyId: rule.propertyId,
      requesterUserId: rule.requesterUserId,
      categoryId: rule.categoryId,
      subcategoryId: rule.subcategoryId,
      supportTeamId: rule.supportTeamId,
      matchNameContains: rule.matchNameContains,
      matchSeverities: rule.matchSeverities,
      severityPriorityMap: rule.severityPriorityMap,
      subjectTemplate: rule.subjectTemplate,
      descriptionTemplate: rule.descriptionTemplate,
      correlationWindowMinutes: rule.correlationWindowMinutes,
      suppressionWindowMinutes: rule.suppressionWindowMinutes,
      autoResolvePolicy: rule.autoResolvePolicy,
    };
    const saved = rule.id
      ? await tx.levelAlertRule.update({
          where: { id_organizationId: { id: rule.id, organizationId: access.organizationId } },
          data,
        })
      : await tx.levelAlertRule.create({ data });
    await new AuditEventRepository(tx).record({
      organizationId: access.organizationId,
      propertyId: rule.propertyId,
      actorUserId: access.userId,
      action: rule.id ? "integration.alert_rule_updated" : "integration.alert_rule_created",
      entityType: "level_alert_rule",
      entityId: saved.id,
      result: "success",
      correlationId,
      metadata: { enabled: saved.isEnabled, dryRun: saved.dryRun },
    });
    return saved;
  });
}

export async function setLevelAlertRuleEnabled(
  access: AccessProfile,
  ruleId: string,
  enabled: boolean,
  correlationId: string,
) {
  assertAdministrator(access);
  return database.$transaction(async (tx) => {
    const rule = await tx.levelAlertRule.update({
      where: { id_organizationId: { id: ruleId, organizationId: access.organizationId } },
      data: { isEnabled: enabled },
    });
    await new AuditEventRepository(tx).record({
      organizationId: access.organizationId,
      propertyId: rule.propertyId,
      actorUserId: access.userId,
      action: enabled ? "integration.alert_rule_enabled" : "integration.alert_rule_disabled",
      entityType: "level_alert_rule",
      entityId: rule.id,
      result: "success",
      correlationId,
      metadata: { dryRun: rule.dryRun },
    });
    return rule;
  });
}

export async function readLevelAlertExceptions(access: AccessProfile) {
  assertAdministrator(access);
  const decisions = await database.levelAlertDecision.findMany({
    where: { organizationId: access.organizationId, outcome: "exception" },
    orderBy: { createdAt: "desc" },
    take: 250,
  });
  const receiptIds = decisions.map((item) => item.receiptId);
  const receipts = await database.levelWebhookReceipt.findMany({
    where: { organizationId: access.organizationId, id: { in: receiptIds } },
    select: {
      id: true,
      eventType: true,
      externalEventId: true,
      alertId: true,
      alertDeviceId: true,
      alertName: true,
      occurredAt: true,
    },
  });
  const byReceipt = new Map(receipts.map((receipt) => [receipt.id, receipt]));
  return decisions.map((item) => ({ ...item, receipt: byReceipt.get(item.receiptId) ?? null }));
}

export async function setLevelAlertExceptionState(
  access: AccessProfile,
  decisionId: string,
  state: "resolved" | "ignored",
  correlationId: string,
) {
  assertAdministrator(access);
  return database.$transaction(async (tx) => {
    const item = await tx.levelAlertDecision.update({
      where: { id_organizationId: { id: decisionId, organizationId: access.organizationId } },
      data: { exceptionState: state },
    });
    if (item.outcome !== "exception") throw new Error("Not an exception.");
    await new AuditEventRepository(tx).record({
      organizationId: access.organizationId,
      actorUserId: access.userId,
      action: `integration.alert_exception_${state}`,
      entityType: "level_alert_decision",
      entityId: item.id,
      result: "success",
      correlationId,
      metadata: { reasonCode: item.reasonCode },
    });
    return item;
  });
}
