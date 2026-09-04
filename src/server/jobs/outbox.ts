import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { database } from "@/server/database/client";
import { jobEventSchema } from "@/server/jobs/policy";

export async function enqueueDomainEvent(tx: Prisma.TransactionClient, raw: unknown) {
  const event = jobEventSchema.parse(raw);
  return tx.outboxEvent.upsert({
    where: {
      organizationId_idempotencyKey: {
        organizationId: event.organizationId,
        idempotencyKey: event.idempotencyKey,
      },
    },
    create: {
      ...event,
      payload: event.payload as Prisma.InputJsonValue,
    },
    update: {},
  });
}

export async function commitWithOutbox<T>(
  mutate: (tx: Prisma.TransactionClient) => Promise<T>,
  eventFor: (result: T) => Parameters<typeof enqueueDomainEvent>[1],
) {
  return database.$transaction(async (tx) => {
    const result = await mutate(tx);
    await enqueueDomainEvent(tx, eventFor(result));
    return result;
  });
}
