import "server-only";

import { getServerEnvironment } from "@/config/server";
import { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseClient } from "@/server/database/factory";

const globalDatabase = globalThis as typeof globalThis & {
  resortDatabase?: PrismaClient;
};

export const database =
  globalDatabase.resortDatabase ?? createDatabaseClient(getServerEnvironment().DATABASE_URL);

if (process.env.NODE_ENV !== "production") globalDatabase.resortDatabase = database;
