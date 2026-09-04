import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { readCurrentAccess } from "@/server/auth/access";
import { requestCorrelationId } from "@/server/audit/correlation";
import { attachmentMaxBytes, AttachmentPolicyError } from "@/server/attachments/policy";
import { uploadTicketAttachment } from "@/server/attachments/service";

const uploadSchema = z.object({
  ticketId: z.string().uuid(),
  visibility: z.enum(["requester", "internal"]),
  returnTo: z.enum(["staff", "technician"]),
  filter: z.string().max(40).optional(),
  page: z.string().regex(/^\d+$/).optional(),
});

function redirectTo(
  request: NextRequest,
  input: { ticketId?: string; returnTo?: string; filter?: string; page?: string },
  status: "uploaded" | "invalid" | "denied" | "failed",
) {
  const technician = input.returnTo === "technician";
  const url = new URL(technician ? "/technician" : "/my-tickets", request.url);
  if (input.ticketId) url.searchParams.set("ticket", input.ticketId);
  if (input.filter) url.searchParams.set("filter", input.filter);
  if (input.page && input.page !== "1") url.searchParams.set("page", input.page);
  url.searchParams.set("attachment", status);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return new NextResponse(null, { status: 403 });

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > attachmentMaxBytes + 1024 * 1024) return redirectTo(request, {}, "invalid");

  const { supabase, finalize } = createSupabaseRouteClient(request);
  const access = await readCurrentAccess(supabase);
  if (!access || access.mustChangePassword)
    return finalize(new NextResponse(null, { status: 403 }));

  const formData = await request.formData();
  const file = formData.get("attachment");
  const raw = {
    ticketId: formData.get("ticketId"),
    visibility: formData.get("visibility"),
    returnTo: formData.get("returnTo"),
    filter: formData.get("filter") || undefined,
    page: formData.get("page") || undefined,
  };

  try {
    const input = uploadSchema.parse(raw);
    if (!(file instanceof File)) throw new AttachmentPolicyError("invalid_file");
    if (file.size > attachmentMaxBytes) throw new AttachmentPolicyError("oversized");
    await uploadTicketAttachment(
      access,
      {
        ticketId: input.ticketId,
        visibility: input.visibility,
        name: file.name,
        declaredContentType: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      },
      requestCorrelationId(request),
    );
    return finalize(redirectTo(request, input, "uploaded"));
  } catch (error) {
    const fallback = {
      ticketId: typeof raw.ticketId === "string" ? raw.ticketId : undefined,
      returnTo: typeof raw.returnTo === "string" ? raw.returnTo : undefined,
      filter: typeof raw.filter === "string" ? raw.filter : undefined,
      page: typeof raw.page === "string" ? raw.page : undefined,
    };
    if (error instanceof AttachmentPolicyError && error.code === "denied")
      return finalize(redirectTo(request, fallback, "denied"));
    if (error instanceof AttachmentPolicyError || error instanceof z.ZodError)
      return finalize(redirectTo(request, fallback, "invalid"));
    return finalize(redirectTo(request, fallback, "failed"));
  }
}
