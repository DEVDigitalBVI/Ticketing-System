import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { readCurrentAccess } from "@/server/auth/access";
import { provisionManagedUser } from "@/server/auth/user-provisioning";

const inputSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(320),
  propertyId: z.string().uuid(),
  role: z.enum(["staff", "technician", "admin"]),
});

function redirectTo(request: NextRequest, status: string) {
  return NextResponse.redirect(new URL(`/admin/users/new?status=${status}`, request.url), 303);
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return new NextResponse(null, { status: 403 });
  const { supabase, finalize } = createSupabaseRouteClient(request);
  const access = await readCurrentAccess(supabase);
  if (!access || !access.roles.includes("admin"))
    return finalize(new NextResponse(null, { status: 403 }));
  if (access.assuranceLevel !== "aal2") return finalize(redirectTo(request, "mfa"));
  const form = await request.formData();
  const input = inputSchema.safeParse({
    displayName: form.get("displayName"),
    email: form.get("email"),
    propertyId: form.get("propertyId"),
    role: form.get("role"),
  });
  if (
    !input.success ||
    !access.properties.some((property) => property.id === input.data.propertyId)
  )
    return finalize(redirectTo(request, "invalid"));
  try {
    await provisionManagedUser(supabase, input.data);
    return finalize(redirectTo(request, "sent"));
  } catch {
    return finalize(redirectTo(request, "failed"));
  }
}
