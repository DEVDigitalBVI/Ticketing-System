import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  createMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  updateMany: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  enqueue: vi.fn(),
  jobCreate: vi.fn(),
  audit: vi.fn(),
}));

const tx = {
  levelWebhookReceipt: {
    createMany: mocks.createMany,
    findUniqueOrThrow: mocks.findUniqueOrThrow,
    findFirst: mocks.findFirst,
  },
  backgroundJob: { create: mocks.jobCreate },
};

vi.mock("@/server/database/client", () => ({
  database: {
    $transaction: mocks.transaction,
    levelWebhookReceipt: {
      updateMany: mocks.updateMany,
      findFirst: mocks.findFirst,
      update: mocks.update,
    },
  },
}));
vi.mock("@/server/jobs/outbox", () => ({ enqueueDomainEvent: mocks.enqueue }));
vi.mock("@/server/repositories/audit-event-repository", () => ({
  AuditEventRepository: class {
    record = mocks.audit;
  },
}));

import type { AccessProfile } from "@/server/auth/access";
import {
  acceptLevelWebhook,
  processLevelWebhookJob,
  replayLevelWebhookReceipt,
} from "@/server/integrations/level/webhook-service";
import type { ClaimedJob } from "@/server/jobs/types";

const ids = {
  organization: "11111111-1111-4111-8111-111111111111",
  event: "22222222-2222-4222-8222-222222222222",
  receipt: "33333333-3333-4333-8333-333333333333",
  correlation: "44444444-4444-4444-8444-444444444444",
};
const receivedAt = new Date("2026-09-08T15:00:01.000Z");
const event = {
  eventType: "device_updated",
  externalEventId: ids.event,
  occurredAt: new Date("2026-09-08T15:00:00.000Z"),
  resourceKey: "device:level-device-1",
  supported: true,
};

function access(role: AccessProfile["roles"][number]): AccessProfile {
  return {
    userId: "55555555-5555-4555-8555-555555555555",
    authUserId: "66666666-6666-4666-8666-666666666666",
    email: "admin@example.invalid",
    displayName: "Administrator",
    organizationId: ids.organization,
    organizationName: "Peter Island Resort and Spa",
    properties: [],
    departmentIds: [],
    roles: [role],
    roleAssignments: [],
    assuranceLevel: "aal1",
    mustChangePassword: false,
  };
}

function claimedJob(): ClaimedJob {
  return {
    id: "77777777-7777-4777-8777-777777777777",
    organizationId: ids.organization,
    category: "webhook",
    jobType: "webhook.level.process",
    payload: { receiptId: ids.receipt },
    correlationId: ids.correlation,
    idempotencyKey: `level-webhook:${ids.event}`,
    effectKey: `level-webhook:${ids.event}`,
    attempts: 1,
    maxAttempts: 5,
    lockToken: "88888888-8888-4888-8888-888888888888",
    recovered: false,
  };
}

describe("Level webhook receipt service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callback) => callback(tx));
    mocks.createMany.mockResolvedValue({ count: 1 });
    mocks.findUniqueOrThrow.mockResolvedValue({ id: ids.receipt, processingState: "accepted" });
    mocks.enqueue.mockResolvedValue({ id: "outbox-1" });
  });

  it("uses the external event ID as the receipt and outbox idempotency key", async () => {
    const result = await acceptLevelWebhook({
      organizationId: ids.organization,
      event,
      correlationId: ids.correlation,
      receivedAt,
    });
    expect(result.duplicate).toBe(false);
    expect(mocks.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalEventId: ids.event,
          diagnostics: { code: "accepted" },
        }),
        skipDuplicates: true,
      }),
    );
    expect(mocks.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        idempotencyKey: `level-webhook:${ids.event}`,
        payload: { receiptId: ids.receipt },
      }),
    );
  });

  it("acknowledges a duplicate without scheduling a second event", async () => {
    mocks.createMany.mockResolvedValue({ count: 0 });
    const result = await acceptLevelWebhook({
      organizationId: ids.organization,
      event,
      correlationId: ids.correlation,
      receivedAt,
    });
    expect(result.duplicate).toBe(true);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("marks an older resource event out of order and performs no ticket action", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findFirst
      .mockResolvedValueOnce({
        id: ids.receipt,
        organizationId: ids.organization,
        resourceKey: event.resourceKey,
        occurredAt: event.occurredAt,
      })
      .mockResolvedValueOnce({ id: "newer-receipt" });
    mocks.update.mockResolvedValue({});
    const result = await processLevelWebhookJob(claimedJob(), receivedAt);
    expect(result.state).toBe("out_of_order");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: ids.receipt },
      data: {
        processingState: "out_of_order",
        diagnostics: { code: "newer_event_already_received" },
        lastProcessedAt: receivedAt,
      },
    });
  });

  it("allows only a system administrator to replay with the original effect key", async () => {
    await expect(
      replayLevelWebhookReceipt(access("it_manager"), ids.receipt, ids.correlation, receivedAt),
    ).rejects.toThrow("Access denied.");
    expect(mocks.transaction).not.toHaveBeenCalled();

    mocks.findFirst.mockResolvedValue({
      id: ids.receipt,
      externalEventId: ids.event,
      eventType: "alert_active",
      processingState: "processed",
    });
    mocks.jobCreate.mockResolvedValue({ id: "replay-job" });
    await replayLevelWebhookReceipt(
      access("system_administrator"),
      ids.receipt,
      ids.correlation,
      receivedAt,
    );
    expect(mocks.jobCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ effectKey: `level-webhook:${ids.event}` }),
    });
    expect(mocks.audit).toHaveBeenCalled();
  });
});
