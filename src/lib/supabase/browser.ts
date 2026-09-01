import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnvironment } from "@/config/public";

export function createSupabaseBrowserClient() {
  const environment = getPublicEnvironment();

  return createBrowserClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
