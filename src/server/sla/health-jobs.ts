import "server-only";

import { database } from "@/server/database/client";

const intervalMs = 5 * 60_000;

export async function enqueueScheduledSlaEvaluations(now: Date) {
  const bucket = Math.floor(now.getTime() / intervalMs);
  const organizations = await database.organization.findMany({ select: { id: true } });
  await Promise.all(
    organizations.map((organization) =>
      database.backgroundJob.upsert({
        where: {
          organizationId_idempotencyKey: {
            organizationId: organization.id,
            idempotencyKey: `sla-health:${organization.id}:${bucket}`,
          },
        },
        create: {
          organizationId: organization.id,
          category: "sla_evaluation",
          jobType: "sla.evaluate",
          payload: {},
          correlationId: crypto.randomUUID(),
          idempotencyKey: `sla-health:${organization.id}:${bucket}`,
          effectKey: `sla-health:${organization.id}:${bucket}`,
          availableAt: now,
        },
        update: {},
      }),
    ),
  );
  return organizations.length;
}

export async function runSlaHealthEvaluation(organizationId: string, now = new Date()) {
  const activeTickets = await database.ticket.count({
    where: {
      organizationId,
      status: { notIn: ["resolved", "closed", "cancelled"] },
    },
  });
  return { evaluated: true, activeTickets, evaluatedAt: now.toISOString() };
}
