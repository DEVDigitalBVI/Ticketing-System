import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { readCurrentAccess } from "@/server/auth/access";
import { accessCan } from "@/server/auth/authorization";
import { provisionManagedUser } from "@/server/auth/user-provisioning";
import { requestCorrelationId } from "@/server/audit/correlation";

const inputSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(320),
  propertyId: z.string().uuid(),
  role: z.enum(["requester", "technician", "it_manager", "system_administrator", "report_viewer"]),
});

function redirectTo(request: NextRequest, status: string) {
  return NextResponse.redirect(new URL(`/admin/users/new?status=${status}`, request.url), 303);
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return new NextResponse(null, { status: 403 });
  const { supabase, finalize } = createSupabaseRouteClient(request);
  const access = await readCurrentAccess(supabase);
  if (!access || access.mustChangePassword || !accessCan(access, "user.manage"))
    return finalize(new NextResponse(null, { status: 403 }));
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
    await provisionManagedUser(supabase, input.data, requestCorrelationId(request));
    return finalize(redirectTo(request, "sent"));
  } catch {
    return finalize(redirectTo(request, "failed"));
  }
}
