import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnvironment } from "@/config/public";
import { getAuthServerEnvironment } from "@/config/server";

export function createSupabaseAdminClient() {
  const publicEnvironment = getPublicEnvironment();
  const serverEnvironment = getAuthServerEnvironment();
  return createClient(
    publicEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    serverEnvironment.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
