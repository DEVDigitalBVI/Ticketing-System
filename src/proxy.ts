import type { NextRequest } from "next/server";

import { updateAuthSession } from "@/lib/supabase/proxy";
import { requestCorrelationId } from "@/server/audit/correlation";
import { writeOperationalLog } from "@/server/observability/logger";

export async function proxy(request: NextRequest) {
  const started = Date.now();
  const correlationId = requestCorrelationId(request);
  request.headers.set("x-request-id", correlationId);
  const response = await updateAuthSession(request);
  response.headers.set("x-request-id", correlationId);
  writeOperationalLog({
    severity: response.status >= 500 ? "error" : response.status >= 400 ? "warning" : "info",
    component: "web-request",
    event: "request_completed",
    correlationId,
    requestId: correlationId,
    durationMs: Date.now() - started,
    status: response.status,
    context: { method: request.method, pathname: request.nextUrl.pathname },
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
