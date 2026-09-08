import "server-only";

import { database } from "@/server/database/client";

export async function recordWorkerHeartbeat(input: {
  instanceId: string;
  startedAt: Date;
  observedAt: Date;
  status?: "healthy" | "degraded" | "stopping";
}) {
  await database.workerHeartbeat.upsert({
    where: { instanceId: input.instanceId },
    create: {
      instanceId: input.instanceId,
      startedAt: input.startedAt,
      lastSeenAt: input.observedAt,
      status: input.status ?? "healthy",
    },
    update: {
      lastSeenAt: input.observedAt,
      status: input.status ?? "healthy",
    },
  });
}
