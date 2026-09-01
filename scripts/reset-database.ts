import "dotenv/config";

import { requireSafeLocalDatabaseUrl, resetServiceDeskSchema, run } from "./database-safety";

const databaseUrl = requireSafeLocalDatabaseUrl(
  process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL,
  "DATABASE_DIRECT_URL or DATABASE_URL",
  "resort_service_desk",
);

const environment = {
  ...process.env,
  DATABASE_DIRECT_URL: databaseUrl,
  DATABASE_URL: databaseUrl,
};

await resetServiceDeskSchema(databaseUrl);
run("./node_modules/.bin/prisma", ["migrate", "deploy"], environment);
