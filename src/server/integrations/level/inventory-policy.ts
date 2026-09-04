import { createHash } from "node:crypto";

import type { LevelDevice } from "@/server/integrations/level/client";

export type CuratedLevelDevice = {
  levelDeviceId: string;
  hostname: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  platform: string | null;
  online: boolean | null;
  lastSeenAt: Date | null;
};

export type AssetMatchCandidate = {
  assetId: string;
  linkedLevelDeviceIds: string[];
};

export type LevelDeviceMatch =
  | { state: "matched"; assetId: string; reason: "external_link" | "serial_number"; createLink: boolean }
  | { state: "unmatched" | "ambiguous" };

function clean(value: string | null | undefined) {
  const result = value?.normalize("NFKC").trim();
  return result ? result : null;
}

export function normalizeSerialNumber(value: string | null | undefined) {
  return clean(value)?.toLocaleUpperCase("en-US") ?? null;
}

export function curateLevelDevice(device: LevelDevice): CuratedLevelDevice {
  return {
    levelDeviceId: device.id.trim(),
    hostname: clean(device.hostname),
    serialNumber: normalizeSerialNumber(device.serial_number),
    manufacturer: clean(device.manufacturer),
    model: clean(device.model),
    platform: clean(device.platform),
    online: device.online ?? null,
    lastSeenAt: device.last_seen_at ? new Date(device.last_seen_at) : null,
  };
}

export function levelDeviceChecksum(device: CuratedLevelDevice) {
  const canonical = {
    levelDeviceId: device.levelDeviceId,
    hostname: device.hostname,
    serialNumber: device.serialNumber,
    manufacturer: device.manufacturer,
    model: device.model,
    platform: device.platform,
    online: device.online,
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function chooseLevelDeviceMatch(input: {
  levelDeviceId: string;
  linkedAssetId?: string;
  serialCandidates: AssetMatchCandidate[];
}): LevelDeviceMatch {
  if (input.linkedAssetId) {
    return {
      state: "matched",
      assetId: input.linkedAssetId,
      reason: "external_link",
      createLink: false,
    };
  }
  if (input.serialCandidates.length === 0) return { state: "unmatched" };
  if (input.serialCandidates.length !== 1) return { state: "ambiguous" };

  const candidate = input.serialCandidates[0];
  if (!candidate) return { state: "unmatched" };
  const conflictingLinks = candidate.linkedLevelDeviceIds.filter(
    (deviceId) => deviceId !== input.levelDeviceId,
  );
  if (conflictingLinks.length > 0) return { state: "ambiguous" };
  return {
    state: "matched",
    assetId: candidate.assetId,
    reason: "serial_number",
    createLink: candidate.linkedLevelDeviceIds.length === 0,
  };
}

export function requireLevelInventoryAccess(
  environment: { LEVEL_API_KEY?: string; LEVEL_ORGANIZATION_ID?: string },
  organizationId: string,
) {
  if (!environment.LEVEL_API_KEY || !environment.LEVEL_ORGANIZATION_ID)
    return { allowed: false as const, code: "level_access_missing" as const };
  if (environment.LEVEL_ORGANIZATION_ID !== organizationId)
    return { allowed: false as const, code: "level_tenant_mismatch" as const };
  return { allowed: true as const, apiKey: environment.LEVEL_API_KEY };
}
