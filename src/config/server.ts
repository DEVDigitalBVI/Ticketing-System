import "server-only";

import { z } from "zod";

const postgresUrl = z.string().refine(
  (value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "postgres:" || protocol === "postgresql:";
    } catch {
      return false;
    }
  },
  { message: "must be a PostgreSQL connection URL" },
);

const serverEnvironmentSchema = z.object({
  DATABASE_URL: postgresUrl,
  DATABASE_DIRECT_URL: postgresUrl.optional(),
});

let cachedEnvironment: z.infer<typeof serverEnvironmentSchema> | undefined;

export function getServerEnvironment() {
  if (cachedEnvironment) return cachedEnvironment;

  const result = serverEnvironmentSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_DIRECT_URL: process.env.DATABASE_DIRECT_URL,
  });

  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid server environment configuration: ${fields.join(", ")}.`);
  }

  cachedEnvironment = result.data;
  return cachedEnvironment;
}
