import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ readiness: vi.fn() }));
vi.mock("@/server/observability/operations", () => ({ readReadiness: mocks.readiness }));

import { GET as live } from "@/app/health/live/route";
import { GET as ready } from "@/app/health/ready/route";

describe("health probes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a dependency-free liveness response and correlation ID", async () => {
    const response = await live(new Request("https://desk.example.invalid/health/live"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(await response.json()).toEqual({ status: "ok", service: "resort-service-desk" });
  });

  it("returns 503 with a safe state when readiness dependencies fail", async () => {
    mocks.readiness.mockResolvedValue({
      ready: false,
      state: "critical",
      checks: [
        {
          key: "database",
          label: "Service database",
          state: "critical",
          summary: "Connection unavailable",
          value: null,
        },
      ],
    });
    const response = await ready(new Request("https://desk.example.invalid/health/ready"));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toMatch(/password|token|postgres:\/\//i);
  });
});
