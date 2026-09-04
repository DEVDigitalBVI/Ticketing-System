import { NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { AssetServiceError } from "@/server/assets/policy";
import {
  assignAsset,
  createAsset,
  editAsset,
  retireAsset,
  transferAsset,
} from "@/server/assets/service";
import { readCurrentAccess } from "@/server/auth/access";
import { requestCorrelationId } from "@/server/audit/correlation";

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
  const assetId = typeof raw.assetId === "string" ? raw.assetId : undefined;
  const detailPath = assetId ? `/assets/${assetId}` : "/assets/new";

  try {
    const correlationId = requestCorrelationId(request);
    if (intent === "create") {
      const asset = await createAsset(access, raw, correlationId);
      return finalize(redirect(request, `/assets/${asset.id}`, "created"));
    }
    if (intent === "edit") {
      await editAsset(access, raw, correlationId);
      return finalize(redirect(request, detailPath, "updated"));
    }
    if (intent === "transfer") {
      await transferAsset(access, raw, correlationId);
      return finalize(redirect(request, detailPath, "transferred"));
    }
    if (intent === "assign") {
      await assignAsset(access, raw, correlationId);
      return finalize(redirect(request, detailPath, "assigned"));
    }
    if (intent === "retire") {
      await retireAsset(access, raw, correlationId);
      return finalize(redirect(request, detailPath, "retired"));
    }
    return finalize(redirect(request, detailPath, "invalid"));
  } catch (error) {
    const status =
      error instanceof AssetServiceError
        ? error.code === "conflict"
          ? "conflict"
          : error.code === "retired"
            ? "retired_error"
            : error.code
        : "failed";
    return finalize(redirect(request, detailPath, status));
  }
}
