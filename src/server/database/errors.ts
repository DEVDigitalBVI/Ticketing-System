import { Prisma } from "@/generated/prisma/client";

export function isDatabaseUnavailableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P1000", "P1001", "P1002", "P1003", "P1012", "P2021", "P2022"].includes(error.code)
  )
    return true;
  return (
    error instanceof Error &&
    (/can't reach database server|authentication failed|connection refused|does not exist/i.test(
      error.message,
    ) ||
      ("code" in error &&
        ["28P01", "3D000", "42P01", "42703", "ECONNREFUSED", "ETIMEDOUT"].includes(
          String((error as Error & { code?: unknown }).code),
        )))
  );
}
