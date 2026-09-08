import { NextResponse } from "next/server";

import { requestCorrelationId } from "@/server/audit/correlation";
import { readReadiness } from "@/server/observability/operations";

export async function GET(request: Request) {
  const correlationId = requestCorrelationId(request);
  const readiness = await readReadiness();
  const response = NextResponse.json(
    { status: readiness.state, ready: readiness.ready, checks: readiness.checks },
    { status: readiness.ready ? 200 : 503 },
  );
  response.headers.set("cache-control", "private, no-store");
  response.headers.set("x-request-id", correlationId);
  return response;
}
