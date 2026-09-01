import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteClient } from "@/lib/supabase/route";

const allowedTypes = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup",
]);

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const { supabase, finalize } = createSupabaseRouteClient(request);

  if (tokenHash && type && allowedTypes.has(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return finalize(NextResponse.redirect(new URL(next, request.url)));
  }

  return finalize(NextResponse.redirect(new URL("/login?error=confirmation", request.url)));
}
