import { describe, expect, it, vi } from "vitest";

import { writeJobLog } from "@/server/jobs/logging";

describe("background worker logs", () => {
  it("serializes only the safe structured log contract", () => {
    const sink = vi.fn();
    writeJobLog(
      {
        event: "job_retry_scheduled",
        jobId: "job-1",
        category: "webhook",
        correlationId: "correlation-1",
        errorCode: "handler_failed",
      },
      sink,
    );
    const value = JSON.parse(sink.mock.calls[0]![0]);
    expect(value).toMatchObject({
      severity: "warning",
      component: "background-worker",
      event: "job_retry_scheduled",
      jobId: "job-1",
      correlationId: "correlation-1",
      errorCode: "handler_failed",
      context: { category: "webhook" },
    });
    expect(value.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(JSON.stringify(value)).not.toContain("payload");
  });
});
