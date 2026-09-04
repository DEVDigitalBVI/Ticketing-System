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

const authServerEnvironmentSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_SECURE: z.enum(["true", "false"]).transform((value) => value === "true"),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  SMTP_FROM: z.string().email(),
});

const levelServerEnvironmentSchema = z.object({
  LEVEL_API_KEY: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(1).optional(),
  ),
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

export function getAuthServerEnvironment() {
  const result = authServerEnvironmentSchema.safeParse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_FROM: process.env.SMTP_FROM,
  });
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid authentication server configuration: ${fields.join(", ")}.`);
  }
  return result.data;
}

export function getLevelServerEnvironment() {
  const result = levelServerEnvironmentSchema.safeParse({
    LEVEL_API_KEY: process.env.LEVEL_API_KEY,
  });
  if (!result.success) throw new Error("Invalid Level integration server configuration.");
  return result.data;
}
