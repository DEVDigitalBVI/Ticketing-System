import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { requestCorrelationId } from "@/server/audit/correlation";
import { readCurrentAccess } from "@/server/auth/access";
import { reconcileLevelDevice } from "@/server/integrations/level/reconciliation";

function redirectTo(request: NextRequest, status: "linked" | "failed") {
  const url = new URL("/admin/integrations/level", request.url);
  url.searchParams.set("reconcile", status);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return new NextResponse(null, { status: 403 });
  const form = await request.formData();
  const parsed = z
    .object({ deviceId: z.string().uuid(), assetId: z.string().uuid() })
    .safeParse({ deviceId: form.get("deviceId"), assetId: form.get("assetId") });
  if (!parsed.success) return redirectTo(request, "failed");
  const { supabase, finalize } = createSupabaseRouteClient(request);
  const access = await readCurrentAccess(supabase);
  if (!access) return finalize(new NextResponse(null, { status: 403 }));
  try {
    await reconcileLevelDevice(access, parsed.data, requestCorrelationId(request));
    return finalize(redirectTo(request, "linked"));
  } catch {
    return finalize(redirectTo(request, "failed"));
  }
}
