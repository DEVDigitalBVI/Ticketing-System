import { describe, expect, it } from "vitest";

import { JobExecutionError, nextRetryAt, retryDelayMs, safeJobError } from "@/server/jobs/policy";

describe("background job policy", () => {
  it("calculates bounded exponential retries from an explicit clock", () => {
    const now = new Date("2026-09-04T12:00:00.000Z");
    expect([1, 2, 3, 4, 5, 9, 20].map(retryDelayMs)).toEqual([
      5_000, 10_000, 20_000, 40_000, 80_000, 900_000, 900_000,
    ]);
    expect(nextRetryAt(now, 4).toISOString()).toBe("2026-09-04T12:00:40.000Z");
  });

  it("only exposes deliberately safe errors and redacts URLs", () => {
    expect(
      safeJobError(
        new JobExecutionError(
          "remote/failed",
          "Provider failed at https://example.invalid/private?signature=secret",
        ),
      ),
    ).toEqual({ code: "remote_failed", message: "Provider failed at [redacted-url]" });
    expect(safeJobError(new Error("password=secret"))).toEqual({
      code: "handler_failed",
      message: "Job handler failed.",
    });
  });
});
