import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { readCurrentAccess } from "@/server/auth/access";
import { requestCorrelationId } from "@/server/audit/correlation";
import {
  addRequesterVisibleReply,
  confirmRequesterTicketResolution,
} from "@/server/tickets/requester-portal";
import { TicketServiceError } from "@/server/tickets/service";

const commentSchema = z.object({
  intent: z.literal("comment"),
  ticketId: z.string().uuid(),
  body: z.string().trim().min(2).max(4000),
  filter: z.enum(["active", "completed", "all"]).optional(),
  q: z.string().max(100).optional(),
  page: z.string().optional(),
});

const confirmSchema = z.object({
  intent: z.literal("confirm"),
  ticketId: z.string().uuid(),
  filter: z.enum(["active", "completed", "all"]).optional(),
  q: z.string().max(100).optional(),
  page: z.string().optional(),
});

function redirectTo(
  request: NextRequest,
  values: { filter?: string; q?: string; page?: string; ticketId?: string },
  status: "commented" | "confirmed" | "failed",
) {
  const url = new URL("/my-tickets", request.url);
  if (values.filter && values.filter !== "active") url.searchParams.set("filter", values.filter);
  if (values.q) url.searchParams.set("q", values.q);
  if (values.page && values.page !== "1") url.searchParams.set("page", values.page);
  if (values.ticketId) url.searchParams.set("ticket", values.ticketId);
  url.searchParams.set("status", status);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return new NextResponse(null, { status: 403 });
  }

  const { supabase, finalize } = createSupabaseRouteClient(request);
  const access = await readCurrentAccess(supabase);
  if (!access || access.mustChangePassword) return finalize(new NextResponse(null, { status: 403 }));

  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const intent = formData.get("intent");

  try {
    if (intent === "comment") {
      const input = commentSchema.parse(raw);
      await addRequesterVisibleReply(
        access,
        input.ticketId,
        input.body,
        requestCorrelationId(request),
      );
      return finalize(
        redirectTo(
          request,
          { filter: input.filter, q: input.q, page: input.page, ticketId: input.ticketId },
          "commented",
        ),
      );
    }

    const input = confirmSchema.parse(raw);
    await confirmRequesterTicketResolution(access, input.ticketId, requestCorrelationId(request));
    return finalize(
      redirectTo(
        request,
        { filter: input.filter, q: input.q, page: input.page, ticketId: input.ticketId },
        "confirmed",
      ),
    );
  } catch (error) {
    const fallback = {
      filter: typeof raw.filter === "string" ? raw.filter : undefined,
      q: typeof raw.q === "string" ? raw.q : undefined,
      page: typeof raw.page === "string" ? raw.page : undefined,
      ticketId: typeof raw.ticketId === "string" ? raw.ticketId : undefined,
    };

    if (error instanceof TicketServiceError) {
      return finalize(redirectTo(request, fallback, "failed"));
    }

    if (error instanceof z.ZodError) {
      return finalize(redirectTo(request, fallback, "failed"));
    }

    return finalize(redirectTo(request, fallback, "failed"));
  }
}
