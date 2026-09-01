import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { readCurrentAccess } from "@/server/auth/access";
import {
  ConfigurationMutationError,
  mutateConfiguration,
} from "@/server/configuration/service";
import { requestCorrelationId } from "@/server/audit/correlation";

function redirectTo(
  request: NextRequest,
  entity: string,
  status: string,
  id?: string,
) {
  const url = new URL("/admin/configuration", request.url);
  url.searchParams.set("entity", entity);
  url.searchParams.set("status", status);
  if (id) url.searchParams.set("id", id);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return new NextResponse(null, { status: 403 });

  const formData = await request.formData();
  const entityType = String(formData.get("entityType") ?? "property");
  const id = typeof formData.get("id") === "string" ? String(formData.get("id")) : undefined;

  const { supabase, finalize } = createSupabaseRouteClient(request);
  const access = await readCurrentAccess(supabase);
  if (!access) return finalize(new NextResponse(null, { status: 403 }));

  try {
    const result = await mutateConfiguration(access, formData, requestCorrelationId(request));
    const status =
      result.intent === "create"
        ? "created"
        : result.intent === "update"
          ? "updated"
          : "deactivated";
    return finalize(redirectTo(request, result.entityType, status));
  } catch (error) {
    if (error instanceof ConfigurationMutationError)
      return finalize(redirectTo(request, error.entityType, error.code, error.id ?? id));
    return finalize(redirectTo(request, entityType, "failed", id));
  }
}
