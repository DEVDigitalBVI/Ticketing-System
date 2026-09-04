import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/database/client", () => ({ database: {} }));

import type { ClaimedJob } from "@/server/jobs/types";
import type { LevelDevice } from "@/server/integrations/level/client";
import { runLevelInventorySync } from "@/server/integrations/level/inventory-sync";
import type { LevelInventoryStore, SyncCounts } from "@/server/integrations/level/inventory-store";

const organizationId = "18b8d97e-9622-4ca7-b344-6230ad863e84";
const environment = {
  LEVEL_API_KEY: "test-key",
  LEVEL_ORGANIZATION_ID: organizationId,
  LEVEL_INVENTORY_SYNC_ENABLED: false,
};

function job(id: string): ClaimedJob {
  return {
    id,
    organizationId,
    category: "synchronization",
    jobType: "synchronization.level_inventory",
    payload: { trigger: "scheduled" },
    correlationId: crypto.randomUUID(),
    idempotencyKey: `inventory:${id}`,
    effectKey: `inventory:${id}`,
    attempts: 1,
    maxAttempts: 5,
    lockToken: crypto.randomUUID(),
    recovered: false,
  };
}

class MemoryStore implements LevelInventoryStore {
  readonly devices = new Map<string, { hostname: string | null; state: string }>();
  readonly links = new Map<string, string>();
  readonly assets = new Map([["SERIAL-1", "asset-1"]]);
  readonly finished: Array<{ status: string; counts: SyncCounts }> = [];

  async startRun() {
    return crypto.randomUUID();
  }
  async synchronizeDevice(input: Parameters<LevelInventoryStore["synchronizeDevice"]>[0]) {
    let state: "matched" | "unmatched" = "unmatched";
    const assetId =
      this.links.get(input.device.levelDeviceId) ??
      (input.device.serialNumber ? this.assets.get(input.device.serialNumber) : undefined);
    if (assetId) {
      state = "matched";
      this.links.set(input.device.levelDeviceId, assetId);
    }
    this.devices.set(input.device.levelDeviceId, { hostname: input.device.hostname, state });
    return state;
  }
  async recordDeviceFailure() {}
  async markStale() {
    return 0;
  }
  async finishRun(input: Parameters<LevelInventoryStore["finishRun"]>[0]) {
    this.finished.push({ status: input.status, counts: { ...input.counts } });
  }
}

function client(devices: LevelDevice[], pageSize: number) {
  return {
    async *paginateDevices() {
      for (let offset = 0; offset < devices.length; offset += pageSize) {
        for (const device of devices.slice(offset, offset + pageSize)) yield device;
      }
    },
  };
}

describe("Level inventory synchronization", () => {
  it("is idempotent across pages and retains one device, asset, and link", async () => {
    const store = new MemoryStore();
    const devices: LevelDevice[] = [
      { id: "level-1", hostname: "Lobby PC", serial_number: "serial-1" },
      { id: "level-2", hostname: "Unknown PC", serial_number: "serial-2" },
    ];
    await runLevelInventorySync({
      job: job(crypto.randomUUID()),
      client: client(devices, 1),
      store,
      environment,
      now: () => new Date("2026-09-04T12:00:00Z"),
    });
    await runLevelInventorySync({
      job: job(crypto.randomUUID()),
      client: client(devices, 1),
      store,
      environment,
      now: () => new Date("2026-09-04T13:00:00Z"),
    });
    expect(store.devices.size).toBe(2);
    expect(store.assets.size).toBe(1);
    expect(store.links).toEqual(new Map([["level-1", "asset-1"]]));
    expect(store.finished.at(-1)).toMatchObject({
      status: "succeeded",
      counts: { seen: 2, matched: 1, unmatched: 1 },
    });
  });

  it("updates a renamed device by stable Level ID and leaves replacement hardware unmatched", async () => {
    const store = new MemoryStore();
    await runLevelInventorySync({
      job: job(crypto.randomUUID()),
      client: client([{ id: "level-1", hostname: "Old name", serial_number: "SERIAL-1" }], 1),
      store,
      environment,
    });
    await runLevelInventorySync({
      job: job(crypto.randomUUID()),
      client: client(
        [
          { id: "level-1", hostname: "New name", serial_number: "SERIAL-1" },
          { id: "level-replacement", hostname: "New name", serial_number: "SERIAL-NEW" },
        ],
        1,
      ),
      store,
      environment,
    });
    expect(store.devices.get("level-1")).toEqual({ hostname: "New name", state: "matched" });
    expect(store.devices.get("level-replacement")?.state).toBe("unmatched");
    expect(store.links.size).toBe(1);
  });

  it("marks missing devices stale only after a complete traversal", async () => {
    const store = new MemoryStore();
    const markStale = vi.spyOn(store, "markStale").mockResolvedValue(1);
    const result = await runLevelInventorySync({
      job: job(crypto.randomUUID()),
      client: client([], 1),
      store,
      environment,
      now: () => new Date("2026-09-04T14:00:00Z"),
    });
    expect(markStale).toHaveBeenCalledWith({
      organizationId,
      seenSince: new Date("2026-09-04T14:00:00Z"),
      now: new Date("2026-09-04T14:00:00Z"),
    });
    expect(result.stale).toBe(1);
  });

  it("retains a partial run and retries when one device persistence fails", async () => {
    const store = new MemoryStore();
    const original = store.synchronizeDevice.bind(store);
    vi.spyOn(store, "synchronizeDevice").mockImplementation(async (input) => {
      if (input.device.levelDeviceId === "level-bad") throw new Error("private database detail");
      return original(input);
    });
    await expect(
      runLevelInventorySync({
        job: job(crypto.randomUUID()),
        client: client(
          [
            { id: "level-1", serial_number: "SERIAL-1" },
            { id: "level-bad", serial_number: "SERIAL-BAD" },
          ],
          1,
        ),
        store,
        environment,
      }),
    ).rejects.toMatchObject({ code: "level_partial_failure" });
    expect(store.finished.at(-1)).toMatchObject({
      status: "partial",
      counts: { seen: 2, matched: 1, failed: 1 },
    });
  });

  it("does not mark devices stale when pagination fails", async () => {
    const store = new MemoryStore();
    const markStale = vi.spyOn(store, "markStale");
    const failedClient = {
      async *paginateDevices(): AsyncGenerator<LevelDevice, void> {
        yield { id: "level-1", serial_number: "SERIAL-1" };
        throw new Error("provider failed");
      },
    };
    await expect(
      runLevelInventorySync({
        job: job(crypto.randomUUID()),
        client: failedClient,
        store,
        environment,
      }),
    ).rejects.toMatchObject({ code: "device_sync_failed" });
    expect(markStale).not.toHaveBeenCalled();
    expect(store.finished.at(-1)?.status).toBe("failed");
  });
});
