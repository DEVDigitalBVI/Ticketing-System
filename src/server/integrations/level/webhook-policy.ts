import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

export const LEVEL_WEBHOOK_MAX_BYTES = 256 * 1024;

export const supportedLevelWebhookEventTypes = [
  "alert_active",
  "alert_resolved",
  "device_created",
  "device_updated",
  "device_deleted",
  "group_created",
  "group_updated",
  "group_deleted",
] as const;

const envelopeSchema = z.object({
  event_type: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{2,99}$/),
  event_id: z.string().uuid(),
  occurred_at: z.string().datetime({ offset: true }),
  data: z.record(z.string(), z.unknown()),
});

const alertSchema = z.object({
  id: z.string().trim().min(1).max(160),
  device_id: z.string().trim().min(1).max(160),
  device_hostname: z.string().trim().min(1).max(255),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(4000),
  payload: z.string().trim().max(1000).nullable().optional(),
  severity: z.enum(["information", "warning", "critical", "emergency"]),
  is_resolved: z.boolean(),
  started_at: z.string().datetime({ offset: true }),
  resolved_at: z.string().datetime({ offset: true }).nullable().optional(),
});

export type LevelAlertContext = {
  id: string;
  deviceId: string;
  deviceName: string;
  name: string;
  description: string;
  payload: string | null;
  severity: "information" | "warning" | "critical" | "emergency";
  isResolved: boolean;
  startedAt: Date;
  resolvedAt: Date | null;
};

export type ParsedLevelWebhook = {
  eventType: string;
  externalEventId: string;
  occurredAt: Date;
  resourceKey: string;
  supported: boolean;
  alertContext?: LevelAlertContext | null;
  alertDataValid?: boolean | null;
};

export class LevelWebhookRequestError extends Error {
  constructor(
    readonly status: 400 | 401 | 413 | 415,
    readonly code: string,
  ) {
    super(code);
    this.name = "LevelWebhookRequestError";
  }
}

export function verifyLevelWebhookSignature(
  body: Uint8Array,
  signature: string | null,
  secrets: readonly string[],
) {
  if (!signature || !/^sha256=[0-9a-f]{64}$/.test(signature) || secrets.length === 0) return false;
  const supplied = Buffer.from(signature.slice(7), "hex");
  return secrets.some((secret) => {
    const expected = createHmac("sha256", secret).update(body).digest();
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
}

export async function readLevelWebhookBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > LEVEL_WEBHOOK_MAX_BYTES)
    throw new LevelWebhookRequestError(413, "payload_too_large");
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > LEVEL_WEBHOOK_MAX_BYTES) {
      await reader.cancel();
      throw new LevelWebhookRequestError(413, "payload_too_large");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function parseLevelWebhook(body: Uint8Array): ParsedLevelWebhook {
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new LevelWebhookRequestError(400, "malformed_payload");
  }
  const parsed = envelopeSchema.safeParse(json);
  if (!parsed.success) throw new LevelWebhookRequestError(400, "malformed_payload");
  const family = parsed.data.event_type.split("_")[0] ?? "event";
  const isAlert =
    parsed.data.event_type === "alert_active" || parsed.data.event_type === "alert_resolved";
  const alert = isAlert ? alertSchema.safeParse(parsed.data.data) : null;
  const resourceId = alert?.success
    ? alert.data.id
    : typeof parsed.data.data.id === "string" && parsed.data.data.id.length <= 160
      ? parsed.data.data.id
      : parsed.data.event_id;
  return {
    eventType: parsed.data.event_type,
    externalEventId: parsed.data.event_id,
    occurredAt: new Date(parsed.data.occurred_at),
    resourceKey: `${family}:${resourceId}`,
    supported: supportedLevelWebhookEventTypes.includes(
      parsed.data.event_type as (typeof supportedLevelWebhookEventTypes)[number],
    ),
    alertContext: alert?.success
      ? {
          id: alert.data.id,
          deviceId: alert.data.device_id,
          deviceName: alert.data.device_hostname,
          name: alert.data.name,
          description: alert.data.description,
          payload: alert.data.payload ?? null,
          severity: alert.data.severity,
          isResolved: alert.data.is_resolved,
          startedAt: new Date(alert.data.started_at),
          resolvedAt: alert.data.resolved_at ? new Date(alert.data.resolved_at) : null,
        }
      : null,
    alertDataValid: isAlert ? Boolean(alert?.success) : null,
  };
}
