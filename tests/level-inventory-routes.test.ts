import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  access: undefined as unknown,
  enqueue: vi.fn(),
  reconcile: vi.fn(),
  finalize: vi.fn((response: Response) => response),
}));

vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteClient: () => ({ supabase: {}, finalize: mocks.finalize }),
}));
vi.mock("@/server/auth/access", () => ({ readCurrentAccess: () => mocks.access }));
vi.mock("@/server/audit/correlation", () => ({ requestCorrelationId: () => crypto.randomUUID() }));
vi.mock("@/server/integrations/level/inventory-jobs", () => ({
  enqueueManualLevelInventorySync: mocks.enqueue,
}));
vi.mock("@/server/integrations/level/reconciliation", () => ({
  reconcileLevelDevice: mocks.reconcile,
}));

import { POST as reconcile } from "@/app/auth/level-reconcile/route";
import { POST as synchronize } from "@/app/auth/level-sync/route";

const origin = "https://service.example.invalid";

describe("Level inventory administrator routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access = { userId: crypto.randomUUID(), organizationId: crypto.randomUUID() };
  });

  it("rejects cross-origin manual sync requests before provider or database access", async () => {
    const response = await synchronize(
      new NextRequest(`${origin}/auth/level-sync`, {
        method: "POST",
        headers: { origin: "https://attacker.example.invalid" },
      }),
    );
    expect(response.status).toBe(403);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated reconciliation", async () => {
    mocks.access = null;
    const body = new FormData();
    body.set("deviceId", crypto.randomUUID());
    body.set("assetId", crypto.randomUUID());
    const response = await reconcile(
      new NextRequest(`${origin}/auth/level-reconcile`, {
        method: "POST",
        headers: { origin },
        body,
      }),
    );
    expect(response.status).toBe(403);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
});
