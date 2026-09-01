import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getPublicEnvironment } from "@/config/public";

type PendingCookie = { name: string; value: string; options: CookieOptions };

export function createSupabaseRouteClient(request: NextRequest) {
  const environment = getPublicEnvironment();
  const pendingCookies: PendingCookie[] = [];
  const pendingHeaders = new Map<string, string>();
  const supabase = createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          pendingCookies.push(...cookiesToSet);
          Object.entries(headers).forEach(([name, value]) => pendingHeaders.set(name, value));
        },
      },
    },
  );

  function finalize(response: NextResponse) {
    pendingCookies.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options),
    );
    pendingHeaders.forEach((value, name) => response.headers.set(name, value));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  return { supabase, finalize };
}
