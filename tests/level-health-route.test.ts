import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  finalize: vi.fn((response: Response) => response),
  readCurrentAccess: vi.fn(),
  accessCan: vi.fn(),
  healthCheck: vi.fn(),
  configured: true,
  auditRecord: vi.fn(),
}));

vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteClient: () => ({ supabase: {}, finalize: mocks.finalize }),
}));
vi.mock("@/server/auth/access", () => ({ readCurrentAccess: mocks.readCurrentAccess }));
vi.mock("@/server/auth/authorization", () => ({ accessCan: mocks.accessCan }));
vi.mock("@/server/audit/correlation", () => ({
  requestCorrelationId: () => "0bade285-7db6-4c08-a7e3-5cba2b31e1cc",
}));
vi.mock("@/server/database/client", () => ({ database: {} }));
vi.mock("@/server/repositories/audit-event-repository", () => ({
  AuditEventRepository: class {
    record = mocks.auditRecord;
  },
}));
vi.mock("@/server/integrations/level/configuration", () => ({
  getLevelConfigurationStatus: () => ({ configured: mocks.configured }),
  requireLevelApiKey: () => "test-key",
}));
vi.mock("@/server/integrations/level/client", () => ({
  LevelClient: class {
    healthCheck = mocks.healthCheck;
  },
  LevelClientError: class LevelClientError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  },
}));

import { POST } from "@/app/auth/level-health/route";
import { LevelClientError } from "@/server/integrations/level/client";

const access = {
  userId: "3ab44059-7981-4439-9e8b-a057eb1bba27",
  organizationId: "18b8d97e-9622-4ca7-b344-6230ad863e84",
};

function request(origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/auth/level-health", {
    method: "POST",
    headers: { origin },
  });
}

describe("Level health route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configured = true;
    mocks.readCurrentAccess.mockResolvedValue(access);
    mocks.accessCan.mockReturnValue(true);
    mocks.auditRecord.mockResolvedValue({});
    mocks.healthCheck.mockResolvedValue({ capability: "read_devices", latencyMs: 12 });
  });

  it("rejects cross-origin and unauthorized checks", async () => {
    expect((await POST(request("https://attacker.invalid"))).status).toBe(403);
    mocks.accessCan.mockReturnValue(false);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.healthCheck).not.toHaveBeenCalled();
  });

  it("runs the read-only check and records safe audit evidence", async () => {
    const response = await POST(request());
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/admin/configuration?level=healthy",
    );
    expect(mocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "success",
        metadata: { capability: "read_devices", latencyMs: 12 },
      }),
    );
  });

  it("maps authentication failures without returning provider details", async () => {
    mocks.healthCheck.mockRejectedValue(
      new LevelClientError("authentication_failed", "Level rejected the API key."),
    );
    const response = await POST(request());
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/admin/configuration?level=authentication_failed",
    );
    expect(mocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "failure",
        metadata: { errorCode: "authentication_failed" },
      }),
    );
  });
});
