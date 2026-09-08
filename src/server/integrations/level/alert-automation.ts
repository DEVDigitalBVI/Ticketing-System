import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { database } from "@/server/database/client";
import { calculateSlaDeadlines, snapshotSlaPolicy } from "@/server/sla/policy";
import {
  impactUrgencyForPriority,
  isResolveBeforeActive,
  levelAlertCorrelationKey,
  levelAlertRuleInputSchema,
  mayAutoResolve,
  renderLevelAlertTemplate,
  ruleMatchesAlert,
} from "@/server/integrations/level/alert-policy";

type AlertReceipt = Awaited<ReturnType<typeof loadReceipt>>;

function loadReceipt(client: Prisma.TransactionClient, id: string, organizationId: string) {
  return client.levelWebhookReceipt.findFirst({ where: { id, organizationId } });
}

function decision(
  tx: Prisma.TransactionClient,
  receipt: NonNullable<AlertReceipt>,
  input: {
    outcome: string;
    reasonCode: string;
    explanation: string;
    ruleId?: string;
    ticketId?: string;
    correlationKey?: string;
    exceptionState?: string;
  },
) {
  return tx.levelAlertDecision.upsert({
    where: {
      organizationId_receiptId: {
        organizationId: receipt.organizationId,
        receiptId: receipt.id,
      },
    },
    create: {
      organizationId: receipt.organizationId,
      receiptId: receipt.id,
      ...input,
    },
    update: {},
  });
}

function alertFromReceipt(receipt: NonNullable<AlertReceipt>) {
  if (
    receipt.alertDataValid !== true ||
    !receipt.alertId ||
    !receipt.alertDeviceId ||
    !receipt.alertDeviceName ||
    !receipt.alertName ||
    !receipt.alertDescription ||
    !receipt.alertSeverity ||
    !receipt.alertStartedAt
  )
    return null;
  if (
    !(["information", "warning", "critical", "emergency"] as string[]).includes(
      receipt.alertSeverity,
    )
  )
    return null;
  return {
    id: receipt.alertId,
    deviceId: receipt.alertDeviceId,
    deviceName: receipt.alertDeviceName,
    name: receipt.alertName,
    description: receipt.alertDescription,
    payload: receipt.alertPayload,
    severity: receipt.alertSeverity as "information" | "warning" | "critical" | "emergency",
    isResolved: receipt.alertIsResolved === true,
    startedAt: receipt.alertStartedAt,
    resolvedAt: receipt.alertResolvedAt,
  };
}

export async function processLevelAlertReceipt(
  receiptId: string,
  organizationId: string,
  processedAt = new Date(),
) {
  return database.$transaction(async (tx) => {
    const prior = await tx.levelAlertDecision.findUnique({
      where: { organizationId_receiptId: { organizationId, receiptId } },
    });
    if (prior) return prior;
    const receipt = await loadReceipt(tx, receiptId, organizationId);
    if (!receipt) throw new Error("level_alert_receipt_missing");
    const alert = alertFromReceipt(receipt);
    if (!alert) {
      return decision(tx, receipt, {
        outcome: "exception",
        reasonCode: "malformed_alert",
        explanation: "The signed event did not contain a complete, approved Level alert object.",
        exceptionState: "open",
      });
    }
    if (
      (receipt.eventType === "alert_active" && alert.isResolved) ||
      (receipt.eventType === "alert_resolved" && !alert.isResolved)
    ) {
      return decision(tx, receipt, {
        outcome: "exception",
        reasonCode: "event_state_mismatch",
        explanation: "The event type and the alert resolved state disagree.",
        exceptionState: "open",
      });
    }
    const newerReceipt = receipt.resourceKey
      ? await tx.levelWebhookReceipt.findFirst({
          where: {
            organizationId,
            resourceKey: receipt.resourceKey,
            occurredAt: { gt: receipt.occurredAt },
            processingState: { not: "unsupported" },
          },
          select: { id: true },
        })
      : null;
    if (newerReceipt) {
      return decision(tx, receipt, {
        outcome: "ignored",
        reasonCode: "out_of_order_event",
        explanation:
          "This event was ignored because a newer event for the same alert was already received.",
      });
    }

    const device = await tx.levelDeviceInventory.findUnique({
      where: {
        organizationId_levelDeviceId: { organizationId, levelDeviceId: alert.deviceId },
      },
    });
    const link = device
      ? await tx.externalSystemLink.findUnique({
          where: {
            organizationId_systemKey_externalId: {
              organizationId,
              systemKey: "level",
              externalId: alert.deviceId,
            },
          },
        })
      : null;
    const asset = link
      ? await tx.asset.findFirst({
          where: { id: link.assetId, organizationId },
          include: { property: true, serviceLocation: true },
        })
      : null;
    if (!device || !asset) {
      return decision(tx, receipt, {
        outcome: "exception",
        reasonCode: device ? "unmatched_device" : "device_not_synchronised",
        explanation: device
          ? "The Level device has no approved link to a local asset."
          : "The Level device is not present in the synchronised inventory.",
        exceptionState: "open",
      });
    }

    const storedRules = await tx.levelAlertRule.findMany({
      where: { organizationId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const parsedRules = storedRules.flatMap((stored) => {
      const parsed = levelAlertRuleInputSchema.safeParse({
        ...stored,
        severityPriorityMap: stored.severityPriorityMap,
      });
      return parsed.success ? [{ stored, rule: parsed.data }] : [];
    });
    const matched = parsedRules.find(({ rule }) => ruleMatchesAlert(rule, alert, asset.propertyId));
    if (!matched) {
      const disabled = parsedRules.some(({ rule }) =>
        ruleMatchesAlert({ ...rule, isEnabled: true }, alert, asset.propertyId),
      );
      return decision(tx, receipt, {
        outcome: "ignored",
        reasonCode: disabled ? "matching_rule_disabled" : "no_matching_rule",
        explanation: disabled
          ? "A matching rule exists but is disabled. No ticket was created."
          : "No enabled rule matched this alert and asset context.",
      });
    }
    const { stored: ruleRecord, rule } = matched;
    const lockScope = `${organizationId}|${alert.id}|${alert.deviceId}|${ruleRecord.id}`;
    await tx.$queryRaw`select pg_advisory_xact_lock(hashtextextended(${lockScope}, 0))`;

    if (receipt.eventType === "alert_resolved") {
      const correlation = await tx.levelAlertCorrelation.findFirst({
        where: {
          organizationId,
          alertId: alert.id,
          levelDeviceId: alert.deviceId,
          ruleId: ruleRecord.id,
        },
        orderBy: { lastProviderEventAt: "desc" },
      });
      if (!correlation || isResolveBeforeActive(correlation.firstActiveAt, receipt.occurredAt)) {
        return decision(tx, receipt, {
          outcome: "exception",
          reasonCode: "resolve_before_active",
          explanation: "A resolved alert arrived before any matching active correlation.",
          ruleId: ruleRecord.id,
          exceptionState: "open",
        });
      }
      if (receipt.occurredAt < correlation.lastProviderEventAt) {
        return decision(tx, receipt, {
          outcome: "ignored",
          reasonCode: "out_of_order_event",
          explanation:
            "An older resolved event was ignored because a newer alert event is recorded.",
          ruleId: ruleRecord.id,
          ticketId: correlation.ticketId,
          correlationKey: correlation.correlationKey,
        });
      }
      const ticket = await tx.ticket.findFirst({
        where: { id: correlation.ticketId, organizationId },
        select: { id: true, status: true, startedAt: true },
      });
      await tx.levelAlertCorrelation.update({
        where: { id: correlation.id },
        data: {
          state: "resolved",
          resolvedAt: receipt.occurredAt,
          lastProviderEventAt: receipt.occurredAt,
        },
      });
      if (ticket && mayAutoResolve(rule.autoResolvePolicy, ticket)) {
        await tx.ticket.update({
          where: { id_organizationId: { id: ticket.id, organizationId } },
          data: {
            status: "resolved",
            resolvedAt: processedAt,
            resolutionCode: "resolved",
            resolutionSummary:
              "Level reported that the correlated alert resolved before technician work began.",
          },
        });
        await tx.ticketActivity.create({
          data: {
            organizationId,
            ticketId: ticket.id,
            activityType: "level_alert_auto_resolved",
            fromStatus: ticket.status,
            toStatus: "resolved",
            requesterVisible: false,
            metadata: { alertId: alert.id, receiptId: receipt.id },
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId,
            propertyId: asset.propertyId,
            action: "integration.level_alert_ticket_resolved",
            entityType: "ticket",
            entityId: ticket.id,
            result: "success",
            correlationId: receipt.correlationId,
            metadata: { alertId: alert.id, ruleId: ruleRecord.id },
          },
        });
        return decision(tx, receipt, {
          outcome: "resolved",
          reasonCode: "auto_resolved_unstarted",
          explanation: "The correlated ticket was resolved because no technician work had started.",
          ruleId: ruleRecord.id,
          ticketId: ticket.id,
          correlationKey: correlation.correlationKey,
        });
      }
      if (ticket) {
        await tx.ticketActivity.create({
          data: {
            organizationId,
            ticketId: ticket.id,
            activityType: "level_alert_resolved",
            requesterVisible: false,
            metadata: { alertId: alert.id, receiptId: receipt.id, autoResolution: "deferred" },
          },
        });
      }
      return decision(tx, receipt, {
        outcome: "resolution_deferred",
        reasonCode: "human_work_preserved",
        explanation:
          "Level resolved the alert, but the ticket remained open to preserve ongoing human work.",
        ruleId: ruleRecord.id,
        ticketId: ticket?.id,
        correlationKey: correlation.correlationKey,
      });
    }

    const windowStart = new Date(
      receipt.occurredAt.getTime() - rule.correlationWindowMinutes * 60_000,
    );
    const active = await tx.levelAlertCorrelation.findFirst({
      where: {
        organizationId,
        alertId: alert.id,
        levelDeviceId: alert.deviceId,
        ruleId: ruleRecord.id,
        state: "active",
        lastActiveAt: { gte: windowStart },
      },
      orderBy: { lastActiveAt: "desc" },
    });
    if (active) {
      await tx.levelAlertCorrelation.update({
        where: { id: active.id },
        data: {
          deliveryCount: { increment: 1 },
          lastActiveAt: receipt.occurredAt,
          lastProviderEventAt: receipt.occurredAt,
        },
      });
      return decision(tx, receipt, {
        outcome: "correlated",
        reasonCode: "existing_open_incident",
        explanation: "The repeated active alert was correlated to the existing open incident.",
        ruleId: ruleRecord.id,
        ticketId: active.ticketId,
        correlationKey: active.correlationKey,
      });
    }
    const suppressionStart = new Date(
      receipt.occurredAt.getTime() - rule.suppressionWindowMinutes * 60_000,
    );
    const recentlyResolved = rule.suppressionWindowMinutes
      ? await tx.levelAlertCorrelation.findFirst({
          where: {
            organizationId,
            alertId: alert.id,
            levelDeviceId: alert.deviceId,
            ruleId: ruleRecord.id,
            state: "resolved",
            resolvedAt: { gte: suppressionStart },
          },
          orderBy: { resolvedAt: "desc" },
        })
      : null;
    if (recentlyResolved) {
      return decision(tx, receipt, {
        outcome: "suppressed",
        reasonCode: "flapping_suppression_window",
        explanation: "The alert reactivated inside the rule suppression window.",
        ruleId: ruleRecord.id,
        ticketId: recentlyResolved.ticketId,
        correlationKey: recentlyResolved.correlationKey,
      });
    }

    const resolvedInCorrelationWindow = await tx.levelAlertCorrelation.findFirst({
      where: {
        organizationId,
        alertId: alert.id,
        levelDeviceId: alert.deviceId,
        ruleId: ruleRecord.id,
        state: "resolved",
        lastActiveAt: { gte: windowStart },
      },
      orderBy: { lastActiveAt: "desc" },
    });
    if (resolvedInCorrelationWindow) {
      const priorTicket = await tx.ticket.findFirst({
        where: { id: resolvedInCorrelationWindow.ticketId, organizationId },
        select: { id: true, status: true },
      });
      await tx.levelAlertCorrelation.update({
        where: { id: resolvedInCorrelationWindow.id },
        data: {
          state: "active",
          resolvedAt: null,
          deliveryCount: { increment: 1 },
          lastActiveAt: receipt.occurredAt,
          lastProviderEventAt: receipt.occurredAt,
        },
      });
      if (priorTicket && ["resolved", "closed", "cancelled"].includes(priorTicket.status)) {
        await tx.ticket.update({
          where: { id_organizationId: { id: priorTicket.id, organizationId } },
          data: {
            status: "triage",
            triagedAt: processedAt,
            resolvedAt: null,
            closedAt: null,
            cancelledAt: null,
            resolutionCode: null,
            resolutionSummary: null,
            closureDetails: null,
          },
        });
        await tx.ticketActivity.create({
          data: {
            organizationId,
            ticketId: priorTicket.id,
            activityType: "level_alert_reactivated",
            fromStatus: priorTicket.status,
            toStatus: "triage",
            requesterVisible: false,
            metadata: { alertId: alert.id, receiptId: receipt.id },
          },
        });
      }
      return decision(tx, receipt, {
        outcome: "correlated",
        reasonCode: "reactivated_existing_incident",
        explanation:
          "The alert reactivated after suppression but inside its correlation window, so the existing incident was reused.",
        ruleId: ruleRecord.id,
        ticketId: resolvedInCorrelationWindow.ticketId,
        correlationKey: resolvedInCorrelationWindow.correlationKey,
      });
    }

    const correlationKey = levelAlertCorrelationKey({
      organizationId,
      alertId: alert.id,
      deviceId: alert.deviceId,
      ruleId: ruleRecord.id,
      occurredAt: receipt.occurredAt,
      windowMinutes: rule.correlationWindowMinutes,
    });
    if (rule.dryRun) {
      return decision(tx, receipt, {
        outcome: "dry_run",
        reasonCode: "matching_rule_dry_run",
        explanation: "The rule matched, but dry-run mode prevented ticket creation.",
        ruleId: ruleRecord.id,
        correlationKey,
      });
    }

    const templateContext = {
      alert,
      device: { name: device.hostname ?? alert.deviceName, id: alert.deviceId },
      asset: { tag: asset.assetTag, name: asset.name },
      property: { name: asset.property.name },
      location: { name: asset.serviceLocation?.name ?? null },
    };
    const priority = rule.severityPriorityMap[alert.severity];
    const classification = impactUrgencyForPriority(priority);
    const storedPolicy = await tx.ticketSlaPolicy.findFirst({
      where: { organizationId, propertyId: asset.propertyId, isActive: true },
      orderBy: { version: "desc" },
    });
    const sla = snapshotSlaPolicy(storedPolicy);
    const deadlines = calculateSlaDeadlines(processedAt, priority, sla);
    const ticket = await tx.ticket.create({
      data: {
        organizationId,
        ticketNumber: "",
        summary: renderLevelAlertTemplate(rule.subjectTemplate, templateContext).slice(0, 180),
        description: renderLevelAlertTemplate(rule.descriptionTemplate, templateContext).slice(
          0,
          10_000,
        ),
        requesterUserId: rule.requesterUserId,
        propertyId: asset.propertyId,
        serviceLocationId: asset.serviceLocationId,
        departmentId: asset.departmentId,
        categoryId: rule.categoryId,
        subcategoryId: rule.subcategoryId,
        primaryAssetId: asset.id,
        impact: classification.impact,
        urgency: classification.urgency,
        priority,
        supportTeamId: rule.supportTeamId,
        source: "system",
        status: rule.supportTeamId ? "assigned" : "new",
        assignedAt: rule.supportTeamId ? processedAt : null,
        slaPolicyId: storedPolicy?.id,
        slaPolicyVersion: sla.version,
        slaPolicySnapshot: sla as unknown as Prisma.InputJsonObject,
        slaResponseDueAt: deadlines.responseDueAt,
        slaResolutionDueAt: deadlines.resolutionDueAt,
      },
    });
    await tx.ticketActivity.create({
      data: {
        organizationId,
        ticketId: ticket.id,
        activityType: "ticket_created_from_level_alert",
        toStatus: ticket.status,
        requesterVisible: false,
        metadata: {
          source: "level",
          alertId: alert.id,
          deviceId: alert.deviceId,
          severity: alert.severity,
          alertStartedAt: alert.startedAt.toISOString(),
          eventOccurredAt: receipt.occurredAt.toISOString(),
          ruleId: ruleRecord.id,
          receiptId: receipt.id,
        },
      },
    });
    if (rule.supportTeamId) {
      await tx.ticketAssignment.create({
        data: {
          organizationId,
          ticketId: ticket.id,
          assignedByUserId: rule.requesterUserId,
          assignedSupportTeamId: rule.supportTeamId,
          note: "Assigned by Level alert automation rule.",
        },
      });
    }
    await tx.levelAlertCorrelation.create({
      data: {
        organizationId,
        ruleId: ruleRecord.id,
        alertId: alert.id,
        levelDeviceId: alert.deviceId,
        correlationKey,
        ticketId: ticket.id,
        firstActiveAt: receipt.occurredAt,
        lastActiveAt: receipt.occurredAt,
        lastProviderEventAt: receipt.occurredAt,
      },
    });
    await tx.auditEvent.create({
      data: {
        organizationId,
        propertyId: asset.propertyId,
        action: "integration.level_alert_ticket_created",
        entityType: "ticket",
        entityId: ticket.id,
        result: "success",
        correlationId: receipt.correlationId,
        metadata: { alertId: alert.id, deviceId: alert.deviceId, ruleId: ruleRecord.id },
      },
    });
    return decision(tx, receipt, {
      outcome: "created",
      reasonCode: "enabled_rule_matched",
      explanation: "An enabled rule matched and created one correlated incident.",
      ruleId: ruleRecord.id,
      ticketId: ticket.id,
      correlationKey,
    });
  });
}
