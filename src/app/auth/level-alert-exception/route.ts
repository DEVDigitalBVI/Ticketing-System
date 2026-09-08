import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { requestCorrelationId } from "@/server/audit/correlation";
import { readCurrentAccess } from "@/server/auth/access";
import { setLevelAlertExceptionState } from "@/server/integrations/level/alert-administration";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return new NextResponse(null, { status: 403 });
  const { supabase, finalize } = createSupabaseRouteClient(request);
  const access = await readCurrentAccess(supabase);
  if (!access) return finalize(new NextResponse(null, { status: 403 }));
  try {
    const form = await request.formData();
    const decisionId = z.string().uuid().parse(form.get("decisionId"));
    const state = z.enum(["resolved", "ignored"]).parse(form.get("state"));
    await setLevelAlertExceptionState(access, decisionId, state, requestCorrelationId(request));
    return finalize(
      NextResponse.redirect(
        new URL("/admin/integrations/level/exceptions?status=saved", request.url),
        303,
      ),
    );
  } catch {
    return finalize(
      NextResponse.redirect(
        new URL("/admin/integrations/level/exceptions?status=failed", request.url),
        303,
      ),
    );
  }
}
