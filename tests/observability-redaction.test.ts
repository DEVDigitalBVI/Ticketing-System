import { describe, expect, it, vi } from "vitest";

import { writeOperationalLog } from "@/server/observability/logger";
import { redactOperationalValue } from "@/server/observability/redaction";

describe("operational log redaction", () => {
  it("removes secrets, raw payloads, file links, private comments, and personal data", () => {
    const value = redactOperationalValue({
      authorization: "Bearer secret-token",
      apiKey: "level-key",
      rawProviderPayload: { hostname: "never-retain" },
      privateComment: "private note",
      fileUrl: "https://files.example.invalid/private.pdf?token=secret",
      detail: "contact person@example.com at https://provider.example.invalid/device/1",
      deviceId: "level-device-1",
    });
    const serialized = JSON.stringify(value);
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("level-key");
    expect(serialized).not.toContain("never-retain");
    expect(serialized).not.toContain("private note");
    expect(serialized).not.toContain("person@example.com");
    expect(serialized).not.toContain("provider.example.invalid");
    expect(serialized).toContain("level-device-1");
  });

  it("keeps correlation and safe error codes in one-line JSON", () => {
    const sink = vi.fn();
    writeOperationalLog(
      {
        severity: "error",
        component: "level-sync",
        event: "provider_failure",
        correlationId: "11111111-1111-4111-8111-111111111111",
        errorCode: "Timeout from provider!",
        context: { token: "secret", attempt: 2 },
      },
      sink,
      new Date("2026-09-08T20:00:00.000Z"),
    );
    const line = sink.mock.calls[0]![0];
    expect(line).not.toContain("secret");
    expect(JSON.parse(line)).toMatchObject({
      timestamp: "2026-09-08T20:00:00.000Z",
      severity: "error",
      correlationId: "11111111-1111-4111-8111-111111111111",
      errorCode: "timeout_from_provider_",
      context: { token: "[redacted]", attempt: 2 },
    });
  });
});
