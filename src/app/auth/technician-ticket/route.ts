import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { readCurrentAccess } from "@/server/auth/access";
import { requestCorrelationId } from "@/server/audit/correlation";
import {
  addTicketComment,
  assignTicket,
  transitionTicket,
  TicketServiceError,
} from "@/server/tickets/service";

const assignSchema = z.object({
  intent: z.literal("assign"),
  ticketId: z.string().uuid(),
  assignedUserId: z.string().uuid().optional().or(z.literal("")),
  assignedSupportTeamId: z.string().uuid().optional().or(z.literal("")),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  note: z.string().trim().max(1000).optional(),
  filter: z
    .enum([
      "unassigned",
      "my_work",
      "team_work",
      "waiting",
      "at_risk",
      "breached",
      "recently_resolved",
    ])
    .optional(),
  page: z.string().optional(),
});

const claimSchema = z.object({
  intent: z.literal("claim"),
  ticketId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  filter: assignSchema.shape.filter,
  page: z.string().optional(),
});

const commentSchema = z.object({
  intent: z.literal("comment"),
  ticketId: z.string().uuid(),
  visibility: z.enum(["requester", "internal"]),
  body: z.string().trim().min(2).max(4000),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  filter: assignSchema.shape.filter,
  page: z.string().optional(),
});

const transitionSchema = z.object({
  intent: z.literal("transition"),
  ticketId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  toStatus: z.enum(["new", "triage", "assigned", "in_progress", "waiting_for_requester", "waiting_for_vendor", "resolved", "closed", "cancelled"]),
  resolutionCode: z.string().optional(),
  resolutionSummary: z.string().trim().max(2000).optional(),
  closureDetails: z.string().trim().max(2000).optional(),
  filter: assignSchema.shape.filter,
  page: z.string().optional(),
});

function normalizedValue(value?: string) {
  return value && value.trim() ? value : undefined;
}

function redirectTo(
  request: NextRequest,
  values: { filter?: string; page?: string; ticketId?: string },
  status: "assigned" | "conflict" | "failed" | "commented" | "noted" | "transitioned",
) {
  const url = new URL("/technician", request.url);
  if (values.filter && values.filter !== "unassigned")
    url.searchParams.set("filter", values.filter);
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
  if (!access || access.mustChangePassword)
    return finalize(new NextResponse(null, { status: 403 }));

  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const intent = formData.get("intent");

  try {
  if (intent === "claim") {
      const input = claimSchema.parse(raw);
      await assignTicket(
        access,
        {
          ticketId: input.ticketId,
          assignedUserId: access.userId,
          expectedUpdatedAt: input.expectedUpdatedAt,
          note: "Claimed from technician workspace.",
        },
        requestCorrelationId(request),
      );
      return finalize(
        redirectTo(
          request,
          { filter: input.filter, page: input.page, ticketId: input.ticketId },
          "assigned",
        ),
      );
    }

    if (intent === "comment") {
      const input = commentSchema.parse(raw);
      await addTicketComment(
        access,
        {
          ticketId: input.ticketId,
          visibility: input.visibility,
          body: input.body,
          expectedUpdatedAt: input.expectedUpdatedAt,
        },
        requestCorrelationId(request),
      );

      return finalize(
        redirectTo(
          request,
          { filter: input.filter, page: input.page, ticketId: input.ticketId },
          input.visibility === "internal" ? "noted" : "commented",
        ),
      );
    }

    if (intent === "transition") {
      const input = transitionSchema.parse(raw);
      await transitionTicket(
        access,
        {
          ticketId: input.ticketId,
          expectedUpdatedAt: input.expectedUpdatedAt,
          toStatus: input.toStatus,
          resolutionCode: normalizedValue(input.resolutionCode),
          resolutionSummary: normalizedValue(input.resolutionSummary),
          closureDetails: normalizedValue(input.closureDetails),
        },
        requestCorrelationId(request),
      );

      return finalize(
        redirectTo(
          request,
          { filter: input.filter, page: input.page, ticketId: input.ticketId },
          "transitioned",
        ),
      );
    }

    const input = assignSchema.parse(raw);
    await assignTicket(
      access,
      {
        ticketId: input.ticketId,
        assignedUserId: normalizedValue(input.assignedUserId),
        assignedSupportTeamId: normalizedValue(input.assignedSupportTeamId),
        expectedUpdatedAt: input.expectedUpdatedAt,
        note: normalizedValue(input.note),
      },
      requestCorrelationId(request),
    );
    return finalize(
      redirectTo(
        request,
        { filter: input.filter, page: input.page, ticketId: input.ticketId },
        "assigned",
      ),
    );
  } catch (error) {
    const fallback = {
      filter: typeof raw.filter === "string" ? raw.filter : undefined,
      page: typeof raw.page === "string" ? raw.page : undefined,
      ticketId: typeof raw.ticketId === "string" ? raw.ticketId : undefined,
    };

    if (error instanceof TicketServiceError && error.code === "conflict") {
      return finalize(redirectTo(request, fallback, "conflict"));
    }

    if (error instanceof TicketServiceError || error instanceof z.ZodError) {
      return finalize(redirectTo(request, fallback, "failed"));
    }

    return finalize(redirectTo(request, fallback, "failed"));
  }
}
