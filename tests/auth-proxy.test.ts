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
