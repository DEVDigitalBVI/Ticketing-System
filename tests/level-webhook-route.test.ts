import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ accept: vi.fn() }));
const secret = "step-23-test-secret-with-at-least-32-characters";
const organizationId = "11111111-1111-4111-8111-111111111111";

vi.mock("@/config/server", () => ({
  getLevelServerEnvironment: () => ({
    LEVEL_ORGANIZATION_ID: organizationId,
    LEVEL_WEBHOOK_SECRET: secret,
    LEVEL_WEBHOOK_PREVIOUS_SECRET: undefined,
  }),
}));
vi.mock("@/server/integrations/level/webhook-service", () => ({
  acceptLevelWebhook: mocks.accept,
}));

import { POST } from "@/app/webhooks/level/route";
import { verifyLevelWebhookSignature } from "@/server/integrations/level/webhook-policy";

function payload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    event_type: "device_updated",
    event_id: "22222222-2222-4222-8222-222222222222",
    occurred_at: "2026-09-08T15:00:00.000Z",
    data: { id: "level-device-1", hostname: "not-retained-by-receipt" },
    ...overrides,
  });
}

function signedRequest(body: string, signatureSecret = secret, headers: HeadersInit = {}) {
  const signature = createHmac("sha256", signatureSecret).update(body).digest("hex");
  return new Request("https://service.example.invalid/webhooks/level", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-level-signature": `sha256=${signature}`,
      ...headers,
    },
    body,
  });
}

describe("Level webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accept.mockResolvedValue({ duplicate: false, unsupported: false });
  });

  it("accepts a correctly signed synthetic event for background processing", async () => {
    const response = await POST(signedRequest(payload()));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true, duplicate: false, unsupported: false });
    expect(mocks.accept).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        event: expect.objectContaining({
          externalEventId: "22222222-2222-4222-8222-222222222222",
          eventType: "device_updated",
          resourceKey: "device:level-device-1",
        }),
      }),
    );
  });

  it("retains only the approved alert context for background rule evaluation", async () => {
    const response = await POST(
      signedRequest(
        payload({
          event_type: "alert_active",
          data: {
            id: "alert-1",
            device_id: "device-1",
            device_hostname: "Front Desk 01",
            name: "Low disk space",
            description: "Disk free space is below threshold",
            payload: "4.3% remaining",
            severity: "critical",
            is_resolved: false,
            started_at: "2026-09-08T14:59:00.000Z",
            unapproved_network_telemetry: { address: "must-not-be-retained" },
          },
        }),
      ),
    );
    expect(response.status).toBe(202);
    expect(mocks.accept).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          alertDataValid: true,
          alertContext: expect.objectContaining({
            id: "alert-1",
            deviceId: "device-1",
            severity: "critical",
          }),
        }),
      }),
    );
    expect(JSON.stringify(mocks.accept.mock.calls[0]?.[0]?.event.alertContext)).not.toContain(
      "unapproved_network_telemetry",
    );
  });

  it("accepts a signed malformed alert into the exception-processing path", async () => {
    const response = await POST(
      signedRequest(payload({ event_type: "alert_active", data: { id: "alert-1" } })),
    );
    expect(response.status).toBe(202);
    expect(mocks.accept).toHaveBeenCalledWith(
      expect.objectContaining({ event: expect.objectContaining({ alertDataValid: false }) }),
    );
  });

  it("rejects an invalid signature before parsing or persistence", async () => {
    const response = await POST(signedRequest("not-json", `${secret}-wrong`));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ accepted: false, code: "invalid_signature" });
    expect(mocks.accept).not.toHaveBeenCalled();
  });

  it("rejects a signed malformed envelope without persistence", async () => {
    const response = await POST(signedRequest(payload({ event_id: "not-a-uuid" })));
    expect(response.status).toBe(400);
    expect(mocks.accept).not.toHaveBeenCalled();
  });

  it("rejects an oversized body before signature verification or persistence", async () => {
    const response = await POST(
      signedRequest(payload(), secret, { "content-length": String(256 * 1024 + 1) }),
    );
    expect(response.status).toBe(413);
    expect(mocks.accept).not.toHaveBeenCalled();
  });

  it("acknowledges duplicate and unsupported signed deliveries with a successful response", async () => {
    mocks.accept.mockResolvedValueOnce({ duplicate: true, unsupported: false });
    expect((await POST(signedRequest(payload()))).status).toBe(200);

    mocks.accept.mockResolvedValueOnce({ duplicate: false, unsupported: true });
    expect((await POST(signedRequest(payload({ event_type: "future_event_type" })))).status).toBe(
      200,
    );
  });

  it("accepts the previous secret during a controlled rotation window", () => {
    const body = new TextEncoder().encode(payload());
    const previousSecret = `${secret}-previous`;
    const signature = `sha256=${createHmac("sha256", previousSecret).update(body).digest("hex")}`;
    expect(verifyLevelWebhookSignature(body, signature, [secret, previousSecret])).toBe(true);
  });
});
