import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  const { supabase, finalize } = createSupabaseRouteClient(request);
  await supabase.auth.signOut();
  return finalize(NextResponse.redirect(new URL("/login", request.url), 303));
}
