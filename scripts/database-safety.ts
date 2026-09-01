import { spawnSync } from "node:child_process";
import { Client } from "pg";

const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const allowedSchema = "service_desk";

export function requireSafeLocalDatabaseUrl(
  value: string | undefined,
  environmentName: string,
  expectedDatabase: string,
) {
  if (!value) throw new Error(`${environmentName} is required.`);

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${environmentName} must be a valid PostgreSQL URL.`);
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const schemaValues = url.searchParams.getAll("schema");
  const safeParameters =
    [...url.searchParams.keys()].every((key) => key === "schema") &&
    schemaValues.length <= 1 &&
    (schemaValues.length === 0 || schemaValues[0] === allowedSchema) &&
    url.hash === "";
  const safe =
    (url.protocol === "postgres:" || url.protocol === "postgresql:") &&
    localHosts.has(url.hostname) &&
    database === expectedDatabase &&
    safeParameters;

  if (!safe) {
    throw new Error(`${environmentName} must target a local database named ${expectedDatabase}.`);
  }

  return url.toString();
}

export async function resetServiceDeskSchema(connectionString: string) {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    await client.query("drop schema if exists service_desk cascade");
  } finally {
    await client.end();
  }
}

export function run(command: string, args: string[], environment: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, {
    env: environment,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
