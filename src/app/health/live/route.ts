import { NextResponse } from "next/server";

import { requestCorrelationId } from "@/server/audit/correlation";

export async function GET(request: Request) {
  const correlationId = requestCorrelationId(request);
  const response = NextResponse.json({ status: "ok", service: "resort-service-desk" });
  response.headers.set("cache-control", "private, no-store");
  response.headers.set("x-request-id", correlationId);
  return response;
}
