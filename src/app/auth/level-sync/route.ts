import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { requestCorrelationId } from "@/server/audit/correlation";
import { readCurrentAccess } from "@/server/auth/access";
import { enqueueManualLevelInventorySync } from "@/server/integrations/level/inventory-jobs";

function redirectTo(request: NextRequest, status: "queued" | "failed") {
  const url = new URL("/admin/integrations/level", request.url);
  url.searchParams.set("sync", status);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return new NextResponse(null, { status: 403 });
  const { supabase, finalize } = createSupabaseRouteClient(request);
  const access = await readCurrentAccess(supabase);
  if (!access) return finalize(new NextResponse(null, { status: 403 }));
  try {
    await enqueueManualLevelInventorySync(access, requestCorrelationId(request), new Date());
    return finalize(redirectTo(request, "queued"));
  } catch {
    return finalize(redirectTo(request, "failed"));
  }
}
