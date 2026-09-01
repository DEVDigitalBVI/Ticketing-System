import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { readCurrentAccess } from "@/server/auth/access";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(1024),
  next: z.string().optional(),
});

function safeNextPath(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function loginRedirect(request: NextRequest, reason: "credentials" | "access") {
  const destination = new URL("/login", request.url);
  destination.searchParams.set("error", reason);
  return NextResponse.redirect(destination, 303);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const credentials = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  const { supabase, finalize } = createSupabaseRouteClient(request);

  if (!credentials.success) return finalize(loginRedirect(request, "credentials"));

  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.data.email,
    password: credentials.data.password,
  });

  if (error) return finalize(loginRedirect(request, "credentials"));

  let access = null;
  try {
    access = await readCurrentAccess(supabase);
  } catch {
    await supabase.auth.signOut();
    return finalize(loginRedirect(request, "access"));
  }

  if (!access) {
    await supabase.auth.signOut();
    return finalize(loginRedirect(request, "access"));
  }

  const nextPath = access.mustChangePassword
    ? "/account/change-password"
    : safeNextPath(credentials.data.next);
  const destination = new URL(nextPath, request.url);
  return finalize(NextResponse.redirect(destination, 303));
}
