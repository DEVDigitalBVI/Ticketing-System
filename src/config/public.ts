import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export function getPublicEnvironment() {
  const result = publicEnvironmentSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid public environment configuration: ${fields.join(", ")}.`);
  }

  return result.data;
}
