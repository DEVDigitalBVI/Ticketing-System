import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@/server/database/factory";
import { processLevelAlertReceipt } from "@/server/integrations/level/alert-automation";

const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL is required for database tests.");
const client = createDatabaseClient(connectionString);
const organizationId = "18b8d97e-9622-4ca7-b344-6230ad863e84";
const propertyId = "ab9c2f07-e909-4f9d-9092-49ad4e06df1f";

beforeAll(async () => client.$connect());
afterAll(async () => client.$disconnect());

describe("Step 24 Level alert incident correlation", () => {
  it("turns a simulated alert storm into one correlated incident", async () => {
    const suffix = crypto.randomUUID();
    const levelDeviceId = `level-storm-${suffix}`;
    const [requester, category, type, status] = await Promise.all([
      client.user.findFirstOrThrow({ where: { organizationId, isActive: true } }),
      client.ticketCategory.findFirstOrThrow({ where: { organizationId, isActive: true } }),
      client.assetType.findFirstOrThrow({ where: { organizationId, isActive: true } }),
      client.assetStatus.findFirstOrThrow({ where: { organizationId, isActive: true } }),
    ]);
    const asset = await client.asset.create({
      data: {
        organizationId,
        propertyId,
        assetTypeId: type.id,
        assetStatusId: status.id,
        assetTag: `STORM-${suffix}`,
        name: "Alert storm test device",
      },
    });
    await client.levelDeviceInventory.create({
      data: {
        organizationId,
        levelDeviceId,
        hostname: "Alert Storm Device",
        sourceChecksum: "a".repeat(64),
        syncState: "matched",
        lastSyncedAt: new Date("2026-09-08T15:00:00.000Z"),
      },
    });
    await client.externalSystemLink.create({
      data: { organizationId, assetId: asset.id, systemKey: "level", externalId: levelDeviceId },
    });
    const rule = await client.levelAlertRule.create({
      data: {
        organizationId,
        name: `Storm test ${suffix}`,
        isEnabled: true,
        dryRun: false,
        propertyId,
        requesterUserId: requester.id,
        categoryId: category.id,
        matchSeverities: ["critical"],
        severityPriorityMap: { information: "P4", warning: "P3", critical: "P2", emergency: "P1" },
        subjectTemplate: "{{alert.name}} · {{device.name}}",
        descriptionTemplate: "{{alert.description}} {{alert.payload}}",
        correlationWindowMinutes: 60,
        suppressionWindowMinutes: 15,
      },
    });
    const receipts = await Promise.all(
      Array.from({ length: 50 }, async (_, index) => {
        const occurredAt = new Date(Date.parse("2026-09-08T15:00:00.000Z") + index * 1_000);
        return client.levelWebhookReceipt.create({
          data: {
            organizationId,
            externalEventId: crypto.randomUUID(),
            eventType: "alert_active",
            resourceKey: `alert:storm-${suffix}`,
            occurredAt,
            receivedAt: occurredAt,
            correlationId: crypto.randomUUID(),
            alertId: `storm-${suffix}`,
            alertDeviceId: levelDeviceId,
            alertDeviceName: "Alert Storm Device",
            alertName: "CPU threshold exceeded",
            alertDescription: "CPU usage is above the approved threshold",
            alertPayload: "98%",
            alertSeverity: "critical",
            alertIsResolved: false,
            alertStartedAt: occurredAt,
            alertDataValid: true,
          },
        });
      }),
    );
    for (const receipt of receipts) {
      await processLevelAlertReceipt(receipt.id, organizationId, receipt.occurredAt);
    }
    const decisions = await client.levelAlertDecision.findMany({
      where: { organizationId, ruleId: rule.id },
    });
    expect(decisions.filter((item) => item.outcome === "created")).toHaveLength(1);
    expect(new Set(decisions.flatMap((item) => (item.ticketId ? [item.ticketId] : []))).size).toBe(
      1,
    );
    expect(
      await client.levelAlertCorrelation.count({ where: { organizationId, ruleId: rule.id } }),
    ).toBe(1);
  });
});
