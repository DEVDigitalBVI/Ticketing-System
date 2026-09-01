import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return new NextResponse(null, { status: 403 });
  const { supabase, finalize } = createSupabaseRouteClient(request);
  await supabase.auth.signOut();
  return finalize(NextResponse.redirect(new URL("/login", request.url), 303));
}
