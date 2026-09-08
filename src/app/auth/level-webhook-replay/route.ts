import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { requestCorrelationId } from "@/server/audit/correlation";
import { readCurrentAccess } from "@/server/auth/access";
import { replayLevelWebhookReceipt } from "@/server/integrations/level/webhook-service";

function redirectTo(request: NextRequest, status: "replayed" | "failed") {
  const url = new URL("/admin/integrations/level", request.url);
  url.searchParams.set("webhook", status);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return new NextResponse(null, { status: 403 });
  const form = await request.formData();
  const receiptId = z.string().uuid().safeParse(form.get("receiptId"));
  if (!receiptId.success) return redirectTo(request, "failed");
  const { supabase, finalize } = createSupabaseRouteClient(request);
  const access = await readCurrentAccess(supabase);
  if (!access) return finalize(new NextResponse(null, { status: 403 }));
  try {
    await replayLevelWebhookReceipt(
      access,
      receiptId.data,
      requestCorrelationId(request),
      new Date(),
    );
    return finalize(redirectTo(request, "replayed"));
  } catch {
    return finalize(redirectTo(request, "failed"));
  }
}
