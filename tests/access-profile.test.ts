import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
import { readCurrentAccess } from "@/server/auth/access";
import { accessCan } from "@/server/auth/authorization";
it("preserves role/property pairs from the authenticated access view", async () => {
  const a = "11111111-1111-4111-8111-111111111111";
  const b = "22222222-2222-4222-8222-222222222222";
  const row = {
    user_id: a,
    auth_user_id: b,
    email: "user@example.invalid",
    display_name: "User",
    must_change_password: false,
    organization_id: a,
    organization_name: "Resort",
    property_name: "Property",
    department_id: null,
  };
  const supabase = {
    auth: { getClaims: async () => ({ data: { claims: { sub: b, aal: "aal1" } } }) },
    schema: () => ({
      from: () => ({
        select: async () => ({
          data: [
            { ...row, property_id: a, role_key: "technician" },
            { ...row, property_id: b, role_key: "requester" },
          ],
        }),
      }),
    }),
  } as unknown as SupabaseClient;
  const profile = await readCurrentAccess(supabase);
  expect(profile).not.toBeNull();
  expect(accessCan(profile!, "ticket.assign", { organizationId: a, propertyId: a })).toBe(true);
  expect(accessCan(profile!, "ticket.assign", { organizationId: a, propertyId: b })).toBe(false);
});
