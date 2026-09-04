import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { requestCorrelationId } from "@/server/audit/correlation";
import { readCurrentAccess } from "@/server/auth/access";
import { replayDeadLetterJob } from "@/server/jobs/operations";

function redirectTo(request: NextRequest, status: "replayed" | "failed") {
  const url = new URL("/admin/jobs", request.url);
  url.searchParams.set("status", status);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return new NextResponse(null, { status: 403 });

  const formData = await request.formData();
  const parsed = z.string().uuid().safeParse(formData.get("jobId"));
  if (!parsed.success) return redirectTo(request, "failed");

  const { supabase, finalize } = createSupabaseRouteClient(request);
  const access = await readCurrentAccess(supabase);
  if (!access) return finalize(new NextResponse(null, { status: 403 }));

  try {
    await replayDeadLetterJob(access, parsed.data, requestCorrelationId(request), new Date());
    return finalize(redirectTo(request, "replayed"));
  } catch {
    return finalize(redirectTo(request, "failed"));
  }
}
