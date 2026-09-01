import { Prisma } from "@/generated/prisma/client";

export function isDatabaseUnavailableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P1001") return true;
  return error instanceof Error && /can't reach database server/i.test(error.message);
}
