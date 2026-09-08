import { NextResponse } from "next/server";

import { getLevelServerEnvironment } from "@/config/server";
import { requestCorrelationId } from "@/server/audit/correlation";
import {
  LevelWebhookRequestError,
  parseLevelWebhook,
  readLevelWebhookBody,
  verifyLevelWebhookSignature,
} from "@/server/integrations/level/webhook-policy";
import { acceptLevelWebhook } from "@/server/integrations/level/webhook-service";
import { writeOperationalLog } from "@/server/observability/logger";

function webhookResponse(
  body: { accepted: boolean; code?: string; duplicate?: boolean; unsupported?: boolean },
  status: number,
  correlationId: string,
) {
  const response = NextResponse.json(body, { status });
  response.headers.set("x-request-id", correlationId);
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export async function POST(request: Request) {
  const correlationId = requestCorrelationId(request);
  try {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
      throw new LevelWebhookRequestError(415, "unsupported_media_type");
    const environment = getLevelServerEnvironment();
    const secrets = [
      environment.LEVEL_WEBHOOK_SECRET,
      environment.LEVEL_WEBHOOK_PREVIOUS_SECRET,
    ].filter((value): value is string => Boolean(value));
    if (!environment.LEVEL_ORGANIZATION_ID || secrets.length === 0)
      return webhookResponse({ accepted: false, code: "not_configured" }, 503, correlationId);

    const body = await readLevelWebhookBody(request);
    if (!verifyLevelWebhookSignature(body, request.headers.get("x-level-signature"), secrets))
      throw new LevelWebhookRequestError(401, "invalid_signature");
    const event = parseLevelWebhook(body);
    const result = await acceptLevelWebhook({
      organizationId: environment.LEVEL_ORGANIZATION_ID,
      event,
      correlationId,
      receivedAt: new Date(),
    });
    return webhookResponse(
      { accepted: true, duplicate: result.duplicate, unsupported: result.unsupported },
      result.duplicate || result.unsupported ? 200 : 202,
      correlationId,
    );
  } catch (error) {
    if (error instanceof LevelWebhookRequestError) {
      writeOperationalLog({
        severity: error.status >= 500 ? "error" : "warning",
        component: "level-webhook",
        event: "webhook_rejected",
        correlationId,
        errorCode: error.code,
        status: error.status,
      });
      return webhookResponse({ accepted: false, code: error.code }, error.status, correlationId);
    }
    writeOperationalLog({
      severity: "error",
      component: "level-webhook",
      event: "webhook_failed",
      correlationId,
      errorCode: "temporarily_unavailable",
      status: 503,
    });
    return webhookResponse(
      { accepted: false, code: "temporarily_unavailable" },
      503,
      correlationId,
    );
  }
}
