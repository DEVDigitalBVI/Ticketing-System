import "dotenv/config";

import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Database configuration is incomplete: set DATABASE_DIRECT_URL or DATABASE_URL.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
