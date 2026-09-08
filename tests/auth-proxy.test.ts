import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ getClaims: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: mocks }) }));
vi.mock("@/config/public", () => ({
  getPublicEnvironment: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test",
  }),
}));
import { updateAuthSession } from "@/lib/supabase/proxy";
import { proxy } from "@/proxy";

beforeEach(() => vi.clearAllMocks());
it("allows login with an existing Auth session so an inactive domain profile can recover", async () => {
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "disabled-domain-user" } } });
  const response = await updateAuthSession(new NextRequest("https://desk.invalid/login"));
  expect(response.status).toBe(200);
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("still redirects anonymous requests away from protected pages", async () => {
  mocks.getClaims.mockResolvedValue({ data: null });
  const response = await updateAuthSession(new NextRequest("https://desk.invalid/technician"));
  expect(response.headers.get("location")).toBe("https://desk.invalid/login?next=%2Ftechnician");
});
it.each(["/health/live", "/health/ready"])(
  "keeps the %s probe independent of the authentication provider",
  async (pathname) => {
    mocks.getClaims.mockRejectedValue(new Error("AUTH_PROVIDER_DOWN"));
    const response = await updateAuthSession(new NextRequest(`https://desk.invalid${pathname}`));
    expect(response.status).toBe(200);
    expect(mocks.getClaims).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  },
);

it("propagates a validated request correlation ID to the response", async () => {
  const requestId = "11111111-1111-4111-8111-111111111111";
  const response = await proxy(
    new NextRequest("https://desk.invalid/health/live", {
      headers: { "x-request-id": requestId },
    }),
  );
  expect(response.headers.get("x-request-id")).toBe(requestId);
});
