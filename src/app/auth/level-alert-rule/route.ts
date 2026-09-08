import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { requestCorrelationId } from "@/server/audit/correlation";
import { readCurrentAccess } from "@/server/auth/access";
import {
  saveLevelAlertRule,
  setLevelAlertRuleEnabled,
} from "@/server/integrations/level/alert-administration";
import { levelAlertSeverities } from "@/server/integrations/level/alert-policy";

function redirect(request: NextRequest, status: "saved" | "failed") {
  const url = new URL("/admin/integrations/level/alert-rules", request.url);
  url.searchParams.set("status", status);
  return NextResponse.redirect(url, 303);
}

function optional(form: FormData, key: string) {
  const value = String(form.get(key) ?? "").trim();
  return value || null;
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return new NextResponse(null, { status: 403 });
  const { supabase, finalize } = createSupabaseRouteClient(request);
  const access = await readCurrentAccess(supabase);
  if (!access) return finalize(new NextResponse(null, { status: 403 }));
  try {
    const form = await request.formData();
    const intent = String(form.get("intent") ?? "save");
    if (intent === "toggle") {
      await setLevelAlertRuleEnabled(
        access,
        String(form.get("ruleId")),
        form.get("enabled") === "true",
        requestCorrelationId(request),
      );
    } else {
      await saveLevelAlertRule(
        access,
        {
          id: optional(form, "id") ?? undefined,
          name: String(form.get("name") ?? ""),
          isEnabled: form.get("isEnabled") === "on",
          dryRun: form.get("dryRun") === "on",
          sortOrder: Number(form.get("sortOrder") ?? 100),
          propertyId: optional(form, "propertyId"),
          requesterUserId: String(form.get("requesterUserId") ?? ""),
          categoryId: String(form.get("categoryId") ?? ""),
          subcategoryId: optional(form, "subcategoryId"),
          supportTeamId: optional(form, "supportTeamId"),
          matchNameContains: optional(form, "matchNameContains"),
          matchSeverities: levelAlertSeverities.filter(
            (severity) => form.get(`severity.${severity}`) === "on",
          ),
          severityPriorityMap: Object.fromEntries(
            levelAlertSeverities.map((severity) => [
              severity,
              String(form.get(`priority.${severity}`) ?? "P3"),
            ]),
          ),
          subjectTemplate: String(form.get("subjectTemplate") ?? ""),
          descriptionTemplate: String(form.get("descriptionTemplate") ?? ""),
          correlationWindowMinutes: Number(form.get("correlationWindowMinutes") ?? 60),
          suppressionWindowMinutes: Number(form.get("suppressionWindowMinutes") ?? 15),
          autoResolvePolicy: String(form.get("autoResolvePolicy") ?? "never"),
        },
        requestCorrelationId(request),
      );
    }
    return finalize(redirect(request, "saved"));
  } catch {
    return finalize(redirect(request, "failed"));
  }
}
