import { describe, expect, it } from "vitest";

import {
  evaluateOperationalHealth,
  overallOperationalState,
} from "@/server/observability/health-policy";

const healthy = {
  databaseAvailable: true,
  workerHeartbeatAgeSeconds: 30,
  oldestQueuedAgeSeconds: null,
  deadLetterCount: 0,
  stuckWebhookAgeSeconds: null,
  levelConfigured: true,
  levelSyncAgeSeconds: 30 * 60,
  deliveryFailureCount: 0,
  notificationFailureCount: 0,
  slaEvaluationAgeSeconds: 4 * 60,
};

describe("operational health policy", () => {
  it("reports all current dependencies as healthy", () => {
    const signals = evaluateOperationalHealth(healthy);
    expect(overallOperationalState(signals)).toBe("healthy");
  });

  it("degrades at warning boundaries and becomes critical at failure boundaries", () => {
    const degraded = evaluateOperationalHealth({
      ...healthy,
      workerHeartbeatAgeSeconds: 90,
      levelSyncAgeSeconds: 90 * 60,
      slaEvaluationAgeSeconds: 10 * 60,
      deliveryFailureCount: 1,
    });
    expect(overallOperationalState(degraded)).toBe("degraded");
    expect(
      degraded.filter((signal) => signal.state === "degraded").map((signal) => signal.key),
    ).toEqual(expect.arrayContaining(["worker", "level-sync", "delivery", "sla"]));

    const critical = evaluateOperationalHealth({
      ...healthy,
      workerHeartbeatAgeSeconds: 180,
      deadLetterCount: 1,
      stuckWebhookAgeSeconds: 300,
      deliveryFailureCount: 3,
    });
    expect(overallOperationalState(critical)).toBe("critical");
  });

  it("reports a failed database without claiming other dependencies are healthy", () => {
    const signals = evaluateOperationalHealth({ ...healthy, databaseAvailable: false });
    expect(signals).toEqual([
      expect.objectContaining({ key: "database", state: "critical", value: null }),
    ]);
  });
});
