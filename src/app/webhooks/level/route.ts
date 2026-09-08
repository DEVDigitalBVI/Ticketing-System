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
      return NextResponse.json({ accepted: false, code: "not_configured" }, { status: 503 });

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
    return NextResponse.json(
      { accepted: true, duplicate: result.duplicate, unsupported: result.unsupported },
      { status: result.duplicate || result.unsupported ? 200 : 202 },
    );
  } catch (error) {
    if (error instanceof LevelWebhookRequestError)
      return NextResponse.json({ accepted: false, code: error.code }, { status: error.status });
    return NextResponse.json({ accepted: false, code: "temporarily_unavailable" }, { status: 503 });
  }
}
