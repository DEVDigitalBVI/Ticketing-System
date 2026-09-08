import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@/server/database/factory";
import { acceptLevelWebhook } from "@/server/integrations/level/webhook-service";

const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL is required for database tests.");
const client = createDatabaseClient(connectionString);
const organizationId = "18b8d97e-9622-4ca7-b344-6230ad863e84";

beforeAll(async () => client.$connect());
afterAll(async () => client.$disconnect());

describe("Step 23 Level webhook receipts", () => {
  it("deduplicates one external event and commits one outbox event", async () => {
    const externalEventId = crypto.randomUUID();
    const input = {
      organizationId,
      event: {
        eventType: "device_updated",
        externalEventId,
        occurredAt: new Date("2026-09-08T15:00:00.000Z"),
        resourceKey: `device:${crypto.randomUUID()}`,
        supported: true,
      },
      correlationId: crypto.randomUUID(),
      receivedAt: new Date("2026-09-08T15:00:01.000Z"),
    };

    expect((await acceptLevelWebhook(input)).duplicate).toBe(false);
    expect(
      (
        await acceptLevelWebhook({
          ...input,
          correlationId: crypto.randomUUID(),
          receivedAt: new Date("2026-09-08T15:00:02.000Z"),
        })
      ).duplicate,
    ).toBe(true);
    expect(
      await client.levelWebhookReceipt.count({ where: { organizationId, externalEventId } }),
    ).toBe(1);
    expect(
      await client.outboxEvent.count({
        where: { organizationId, idempotencyKey: `level-webhook:${externalEventId}` },
      }),
    ).toBe(1);
  });
});
