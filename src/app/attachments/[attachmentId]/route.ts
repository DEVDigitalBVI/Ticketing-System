import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { readCurrentAccess } from "@/server/auth/access";
import { AttachmentPolicyError } from "@/server/attachments/policy";
import { downloadTicketAttachment } from "@/server/attachments/service";

function contentDisposition(fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ attachmentId: string }> },
) {
  const { supabase, finalize } = createSupabaseRouteClient(request);
  const access = await readCurrentAccess(supabase);
  if (!access || access.mustChangePassword)
    return finalize(new NextResponse(null, { status: 404 }));

  try {
    const { attachmentId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(attachmentId)) throw new AttachmentPolicyError("not_found");
    const attachment = await downloadTicketAttachment(access, attachmentId);
    return finalize(
      new NextResponse(attachment.data, {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Content-Disposition": contentDisposition(attachment.fileName),
          "Content-Length": String(attachment.byteSize),
          "Content-Type": attachment.contentType,
          "X-Content-Type-Options": "nosniff",
        },
      }),
    );
  } catch (error) {
    if (error instanceof AttachmentPolicyError) {
      const status = error.code === "quarantined" ? 423 : 404;
      return finalize(new NextResponse(null, { status }));
    }
    return finalize(new NextResponse(null, { status: 404 }));
  }
}
