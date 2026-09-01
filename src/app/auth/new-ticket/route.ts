import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { readCurrentAccess } from "@/server/auth/access";
import { accessCan } from "@/server/auth/authorization";
import { requestCorrelationId } from "@/server/audit/correlation";
import { submitNewTicketRequest, ticketSubmissionCookieName } from "@/server/tickets/intake";
import { TicketServiceError } from "@/server/tickets/service";

function redirectTo(
  request: NextRequest,
  status: "created" | "invalid" | "denied" | "failed",
  ticketNumber?: string,
) {
  const url = new URL("/new-ticket", request.url);
  url.searchParams.set("status", status);
  if (ticketNumber) url.searchParams.set("ticket", ticketNumber);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return new NextResponse(null, { status: 403 });

  const { supabase, finalize } = createSupabaseRouteClient(request);
  const access = await readCurrentAccess(supabase);
  if (
    !access ||
    access.mustChangePassword ||
    !accessCan(access, "ticket.submit", { organizationId: access.organizationId })
  ) {
    return finalize(new NextResponse(null, { status: 403 }));
  }

  const formData = await request.formData();

  try {
    const result = await submitNewTicketRequest(
      access,
      formData,
      requestCorrelationId(request),
      request.cookies.get(ticketSubmissionCookieName)?.value,
    );
    const response = redirectTo(request, "created", result.ticketNumber);
    response.cookies.set(ticketSubmissionCookieName, result.cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 5 * 60,
    });
    return finalize(response);
  } catch (error) {
    if (error instanceof TicketServiceError) {
      if (error.code === "denied") return finalize(redirectTo(request, "denied"));
      if (error.code === "invalid") return finalize(redirectTo(request, "invalid"));
    }

    return finalize(redirectTo(request, "failed"));
  }
}
