import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { readCurrentAccess } from "@/server/auth/access";
import { requestCorrelationId } from "@/server/audit/correlation";
import { KnowledgeError } from "@/server/knowledge/policy";
import {
  createKnowledgeArticle,
  linkKnowledgeToTicket,
  recordKnowledgeFeedback,
  transitionKnowledgeArticle,
  updateKnowledgeArticle,
} from "@/server/knowledge/service";

function redirect(request: NextRequest, path: string, status: string) {
  const url = new URL(path, request.url);
  url.searchParams.set("status", status);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return new NextResponse(null, { status: 403 });
  const { supabase, finalize } = createSupabaseRouteClient(request);
  const access = await readCurrentAccess(supabase);
  if (!access || access.mustChangePassword)
    return finalize(new NextResponse(null, { status: 403 }));
  const raw = Object.fromEntries((await request.formData()).entries());
  const intent = typeof raw.intent === "string" ? raw.intent : "";
  const articleId = typeof raw.articleId === "string" ? raw.articleId : "";
  try {
    const correlationId = requestCorrelationId(request);
    if (intent === "create") {
      const article = await createKnowledgeArticle(access, raw, correlationId);
      return finalize(redirect(request, `/knowledge/${article.id}`, "created"));
    }
    if (intent === "update") {
      const article = await updateKnowledgeArticle(access, raw, correlationId);
      return finalize(redirect(request, `/knowledge/${article.id}`, "updated"));
    }
    if (intent === "transition") {
      const article = await transitionKnowledgeArticle(access, raw, correlationId);
      return finalize(redirect(request, `/knowledge/${article.id}`, article.state));
    }
    if (intent === "feedback") {
      await recordKnowledgeFeedback(access, raw, correlationId);
      return finalize(redirect(request, `/knowledge/${articleId}`, "feedback"));
    }
    if (intent === "link") {
      await linkKnowledgeToTicket(access, raw, correlationId);
      const ticketId = typeof raw.ticketId === "string" ? raw.ticketId : "";
      return finalize(
        redirect(request, `/technician?ticket=${encodeURIComponent(ticketId)}`, "linked"),
      );
    }
    return finalize(
      redirect(request, articleId ? `/knowledge/${articleId}` : "/knowledge", "invalid"),
    );
  } catch (error) {
    const status = error instanceof KnowledgeError ? error.code : "failed";
    return finalize(
      redirect(request, articleId ? `/knowledge/${articleId}` : "/knowledge/new", status),
    );
  }
}
