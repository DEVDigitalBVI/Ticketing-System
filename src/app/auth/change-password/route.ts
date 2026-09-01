import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { readCurrentAccess } from "@/server/auth/access";

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(12)
      .max(1024)
      .regex(/[a-z]/)
      .regex(/[A-Z]/)
      .regex(/[0-9]/)
      .regex(/[^A-Za-z0-9]/),
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation);

export async function POST(request: NextRequest) {
  const { supabase, finalize } = createSupabaseRouteClient(request);
  const access = await readCurrentAccess(supabase);
  if (!access) return finalize(NextResponse.redirect(new URL("/login", request.url), 303));
  const form = await request.formData();
  const parsed = passwordSchema.safeParse({
    password: form.get("password"),
    confirmation: form.get("confirmation"),
  });
  if (!parsed.success)
    return finalize(
      NextResponse.redirect(new URL("/account/change-password?error=policy", request.url), 303),
    );
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error)
    return finalize(
      NextResponse.redirect(new URL("/account/change-password?error=update", request.url), 303),
    );
  const { error: profileError } = await supabase
    .schema("api")
    .rpc("complete_initial_password_change");
  if (profileError)
    return finalize(
      NextResponse.redirect(new URL("/account/change-password?error=profile", request.url), 303),
    );
  await supabase.auth.signOut({ scope: "others" });
  return finalize(NextResponse.redirect(new URL("/", request.url), 303));
}
