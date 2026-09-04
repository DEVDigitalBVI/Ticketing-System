import "server-only";

import { getLevelServerEnvironment } from "@/config/server";

export function getLevelConfigurationStatus() {
  const environment = getLevelServerEnvironment();
  return {
    configured: Boolean(environment.LEVEL_API_KEY),
    credentialSource: "server_environment" as const,
    accessMode: "read_only_required" as const,
    baseUrl: "https://api.level.io" as const,
  };
}

export function requireLevelApiKey() {
  const key = getLevelServerEnvironment().LEVEL_API_KEY;
  if (!key) throw new Error("Level is not configured.");
  return key;
}
