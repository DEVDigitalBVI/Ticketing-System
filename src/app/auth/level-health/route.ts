import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { requestCorrelationId } from "@/server/audit/correlation";
import { readCurrentAccess } from "@/server/auth/access";
import { accessCan } from "@/server/auth/authorization";
import { database } from "@/server/database/client";
import { LevelClient, LevelClientError } from "@/server/integrations/level/client";
import {
  getLevelConfigurationStatus,
  requireLevelApiKey,
} from "@/server/integrations/level/configuration";
import { AuditEventRepository } from "@/server/repositories/audit-event-repository";

const browserStatuses = new Set([
  "authentication_failed",
  "permission_denied",
  "throttled",
  "timeout",
  "malformed_response",
]);

function redirectTo(request: NextRequest, level: string) {
  const url = new URL("/admin/configuration", request.url);
  url.searchParams.set("level", level);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return new NextResponse(null, { status: 403 });

  const { supabase, finalize } = createSupabaseRouteClient(request);
  const access = await readCurrentAccess(supabase);
  if (!access || !accessCan(access, "configuration.manage"))
    return finalize(new NextResponse(null, { status: 403 }));

  if (!getLevelConfigurationStatus().configured)
    return finalize(redirectTo(request, "failed"));

  const correlationId = requestCorrelationId(request);
  try {
    const result = await new LevelClient({ apiKey: requireLevelApiKey() }).healthCheck({
      correlationId,
    });
    await new AuditEventRepository(database).record({
      organizationId: access.organizationId,
      actorUserId: access.userId,
      action: "integration.health_checked",
      entityType: "level_integration",
      result: "success",
      correlationId,
      metadata: { capability: result.capability, latencyMs: result.latencyMs },
    });
    return finalize(redirectTo(request, "healthy"));
  } catch (error) {
    const code = error instanceof LevelClientError ? error.code : "failed";
    await new AuditEventRepository(database)
      .record({
        organizationId: access.organizationId,
        actorUserId: access.userId,
        action: "integration.health_checked",
        entityType: "level_integration",
        result: "failure",
        correlationId,
        metadata: { errorCode: code },
      })
      .catch(() => undefined);
    return finalize(redirectTo(request, browserStatuses.has(code) ? code : "failed"));
  }
}
