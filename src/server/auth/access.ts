import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const accessRowSchema = z.object({
  user_id: z.string().uuid(),
  auth_user_id: z.string().uuid(),
  email: z.string().email(),
  display_name: z.string().min(1),
  must_change_password: z.boolean(),
  organization_id: z.string().uuid(),
  organization_name: z.string().min(1),
  property_id: z.string().uuid(),
  property_name: z.string().min(1),
  role_key: z.string().min(1),
});

export type AccessProfile = {
  userId: string;
  authUserId: string;
  email: string;
  displayName: string;
  organizationId: string;
  organizationName: string;
  properties: Array<{ id: string; name: string }>;
  roles: string[];
  assuranceLevel: "aal1" | "aal2";
  mustChangePassword: boolean;
};

export async function readCurrentAccess(supabase: SupabaseClient) {
  const { data: claimData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimData?.claims?.sub) return null;

  const { data, error } = await supabase
    .schema("api")
    .from("current_user_access")
    .select(
      "user_id,auth_user_id,email,display_name,must_change_password,organization_id,organization_name,property_id,property_name,role_key",
    );

  if (error) throw new Error("The authenticated access profile could not be loaded.");

  const rows = accessRowSchema.array().parse(data ?? []);
  if (!rows.length) return null;

  const first = rows[0];
  const properties = new Map(rows.map((row) => [row.property_id, row.property_name]));
  const assuranceLevel = claimData.claims.aal === "aal2" ? "aal2" : "aal1";

  return {
    userId: first.user_id,
    authUserId: first.auth_user_id,
    email: first.email,
    displayName: first.display_name,
    organizationId: first.organization_id,
    organizationName: first.organization_name,
    properties: [...properties].map(([id, name]) => ({ id, name })),
    roles: [...new Set(rows.map((row) => row.role_key))],
    assuranceLevel,
    mustChangePassword: first.must_change_password,
  } satisfies AccessProfile;
}

export const getCurrentAccess = cache(async () => {
  const supabase = await createSupabaseServerClient();
  return readCurrentAccess(supabase);
});
