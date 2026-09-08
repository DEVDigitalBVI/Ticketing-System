import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/server/database/client", () => ({
  database: { operationalEvent: { create: mocks.create } },
}));

import { recordOperationalFailure } from "@/server/observability/events";

describe("operational failure reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ id: "event-1" });
  });

  it("persists a useful diagnostic trail with redacted context", async () => {
    await expect(
      recordOperationalFailure({
        organizationId: "11111111-1111-4111-8111-111111111111",
        component: "level-sync",
        eventType: "provider_failure",
        errorCode: "provider_timeout",
        correlationId: "22222222-2222-4222-8222-222222222222",
        context: { attempt: 3, apiKey: "never-store", rawProviderPayload: { secret: true } },
      }),
    ).resolves.toBe(true);
    const data = mocks.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      errorCode: "provider_timeout",
      correlationId: "22222222-2222-4222-8222-222222222222",
    });
    expect(JSON.stringify(data.safeContext)).not.toContain("never-store");
    expect(data.safeContext).toMatchObject({ attempt: 3, apiKey: "[redacted]" });
  });

  it("reports persistence failure without throwing or leaking the original context", async () => {
    mocks.create.mockRejectedValue(new Error("postgres://user:password@private-host/database"));
    await expect(
      recordOperationalFailure({
        organizationId: "11111111-1111-4111-8111-111111111111",
        component: "worker",
        eventType: "worker_failure",
        errorCode: "runtime_failed",
        correlationId: "22222222-2222-4222-8222-222222222222",
      }),
    ).resolves.toBe(false);
  });
});
