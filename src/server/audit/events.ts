import "server-only";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const auditEventSchema = z.object({
  id: z.string().uuid(),
  actor_display_name: z.string().min(1),
  action: z.string().min(1),
  target_type: z.string().min(1),
  target_id: z.string().nullable(),
  result: z.enum(["success", "denied", "failure"]),
  request_correlation_id: z.string().uuid(),
  context: z.record(z.string(), z.unknown()),
  occurred_at: z.string().datetime({ offset: true }),
});

export type AuditEventView = {
  id: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string | null;
  result: "success" | "denied" | "failure";
  correlationId: string;
  context: Record<string, unknown>;
  occurredAt: string;
};

export async function listAuditEvents(limit = 50): Promise<AuditEventView[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema("api").rpc("list_audit_events", {
    result_limit: Math.min(Math.max(limit, 1), 100),
  });
  if (error) throw new Error("Audit events could not be loaded.");
  return auditEventSchema
    .array()
    .parse(data ?? [])
    .map((event) => ({
      id: event.id,
      actor: event.actor_display_name,
      action: event.action,
      targetType: event.target_type,
      targetId: event.target_id,
      result: event.result,
      correlationId: event.request_correlation_id,
      context: event.context,
      occurredAt: event.occurred_at,
    }));
}
