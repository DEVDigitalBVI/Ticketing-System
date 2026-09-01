import "dotenv/config";

import { requireSafeLocalDatabaseUrl, resetServiceDeskSchema, run } from "./database-safety";

const testDatabaseUrl = requireSafeLocalDatabaseUrl(
  process.env.TEST_DATABASE_URL,
  "TEST_DATABASE_URL",
  "resort_service_desk_test",
);

const testEnvironment = {
  ...process.env,
  DATABASE_DIRECT_URL: testDatabaseUrl,
  DATABASE_URL: testDatabaseUrl,
};

await resetServiceDeskSchema(testDatabaseUrl);
run("./node_modules/.bin/prisma", ["migrate", "deploy"], testEnvironment);
run(
  "./node_modules/.bin/vitest",
  ["run", "--config", "vitest.database.config.ts"],
  testEnvironment,
);
