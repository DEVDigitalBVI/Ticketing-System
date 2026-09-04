import { describe, expect, it } from "vitest";

import {
  chooseLevelDeviceMatch,
  curateLevelDevice,
  levelDeviceChecksum,
  requireLevelInventoryAccess,
} from "@/server/integrations/level/inventory-policy";

describe("Level inventory identity policy", () => {
  it("prefers an existing external link over every deterministic candidate", () => {
    expect(
      chooseLevelDeviceMatch({
        levelDeviceId: "level-1",
        linkedAssetId: "asset-linked",
        serialCandidates: [
          { assetId: "asset-a", linkedLevelDeviceIds: [] },
          { assetId: "asset-b", linkedLevelDeviceIds: [] },
        ],
      }),
    ).toEqual({
      state: "matched",
      assetId: "asset-linked",
      reason: "external_link",
      createLink: false,
    });
  });

  it("matches only one unlinked normalized serial and never uses hostname", () => {
    expect(
      chooseLevelDeviceMatch({
        levelDeviceId: "level-1",
        serialCandidates: [{ assetId: "asset-a", linkedLevelDeviceIds: [] }],
      }),
    ).toEqual({
      state: "matched",
      assetId: "asset-a",
      reason: "serial_number",
      createLink: true,
    });
    expect(
      chooseLevelDeviceMatch({ levelDeviceId: "level-replacement", serialCandidates: [] }),
    ).toEqual({ state: "unmatched" });
  });

  it("sends duplicate serials and replacement conflicts to reconciliation", () => {
    expect(
      chooseLevelDeviceMatch({
        levelDeviceId: "level-1",
        serialCandidates: [
          { assetId: "asset-a", linkedLevelDeviceIds: [] },
          { assetId: "asset-b", linkedLevelDeviceIds: [] },
        ],
      }),
    ).toEqual({ state: "ambiguous" });
    expect(
      chooseLevelDeviceMatch({
        levelDeviceId: "level-replacement",
        serialCandidates: [{ assetId: "asset-a", linkedLevelDeviceIds: ["level-original"] }],
      }),
    ).toEqual({ state: "ambiguous" });
  });

  it("produces the same curated checksum independent of unapproved provider fields", () => {
    const first = curateLevelDevice({
      id: "level-1",
      hostname: " Front Desk ",
      serial_number: " ab-123 ",
      online: true,
      last_seen_at: "2026-09-04T12:00:00Z",
      unapproved: "ignored",
    });
    const second = curateLevelDevice({
      id: "level-1",
      hostname: "Front Desk",
      serial_number: "AB-123",
      online: true,
      last_seen_at: "2026-09-04T12:00:00Z",
      another: "ignored",
    });
    expect(first.serialNumber).toBe("AB-123");
    expect(levelDeviceChecksum(first)).toBe(levelDeviceChecksum(second));
  });

  it("refuses missing credentials and cross-organisation tenant mappings", () => {
    expect(requireLevelInventoryAccess({}, "org-a")).toEqual({
      allowed: false,
      code: "level_access_missing",
    });
    expect(
      requireLevelInventoryAccess(
        { LEVEL_API_KEY: "secret", LEVEL_ORGANIZATION_ID: "org-b" },
        "org-a",
      ),
    ).toEqual({ allowed: false, code: "level_tenant_mismatch" });
  });
});
