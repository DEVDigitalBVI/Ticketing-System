import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { LevelClient, LevelClientError } from "@/server/integrations/level/client";

const correlationId = "e82890c0-dc53-4850-85ab-a7ce7bdd040b";

afterEach(() => vi.useRealTimers());

describe("Level read-only client", () => {
  it("uses the documented raw Authorization key and validates a health response", async () => {
    const logger = vi.fn();
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("level-test-key");
      expect(new Headers(init?.headers).get("authorization")).not.toContain("Bearer");
      return Response.json({
        data: [{ id: "device-1", hostname: "fixture-device" }],
        has_more: false,
      });
    });
    const client = new LevelClient({ apiKey: "level-test-key", fetcher, logger });

    await expect(client.healthCheck({ correlationId })).resolves.toMatchObject({
      healthy: true,
      capability: "read_devices",
    });
    expect(String(fetcher.mock.calls[0]![0])).toBe("https://api.level.io/v2/devices?limit=1");
    expect(JSON.stringify(logger.mock.calls)).not.toContain("level-test-key");
    expect(JSON.stringify(logger.mock.calls)).not.toContain("fixture-device");
  });

  it("does not retry authentication or permission failures", async () => {
    for (const [status, code] of [
      [401, "authentication_failed"],
      [403, "permission_denied"],
    ] as const) {
      const fetcher = vi.fn(async () => new Response(null, { status }));
      const client = new LevelClient({
        apiKey: "invalid",
        fetcher,
        maxRetries: 4,
        logger: vi.fn(),
      });
      await expect(client.healthCheck({ correlationId })).rejects.toMatchObject({ code });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it("honors Retry-After within a bound and retries throttling", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "Retry-After": "2" } }))
      .mockResolvedValueOnce(Response.json({ data: [], has_more: false }));
    const client = new LevelClient({
      apiKey: "test",
      fetcher,
      sleep,
      maxRetries: 1,
      logger: vi.fn(),
    });
    await expect(client.healthCheck({ correlationId })).resolves.toMatchObject({ healthy: true });
    expect(sleep).toHaveBeenCalledWith(2_000, undefined);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("caps an excessive Retry-After value", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "Retry-After": "900" } }))
      .mockResolvedValueOnce(Response.json({ data: [], has_more: false }));
    const client = new LevelClient({
      apiKey: "test",
      fetcher,
      sleep,
      maxRetries: 1,
      maximumRetryAfterMs: 1_500,
      logger: vi.fn(),
    });
    await client.healthCheck({ correlationId });
    expect(sleep).toHaveBeenCalledWith(1_500, undefined);
  });

  it("parses an HTTP-date Retry-After against the injected clock", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 429,
          headers: { "Retry-After": "Fri, 04 Sep 2026 12:00:03 GMT" },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: [], has_more: false }));
    const client = new LevelClient({
      apiKey: "test",
      fetcher,
      sleep,
      maxRetries: 1,
      now: () => new Date("2026-09-04T12:00:00.000Z"),
      logger: vi.fn(),
    });
    await client.healthCheck({ correlationId });
    expect(sleep).toHaveBeenCalledWith(3_000, undefined);
  });

  it("returns a controlled throttled error after bounded retries", async () => {
    const fetcher = vi.fn(
      async () => new Response(null, { status: 429, headers: { "Retry-After": "4" } }),
    );
    const client = new LevelClient({
      apiKey: "test",
      fetcher,
      sleep: async () => undefined,
      maxRetries: 1,
      logger: vi.fn(),
    });
    await expect(client.healthCheck({ correlationId })).rejects.toMatchObject({
      code: "throttled",
      message: "Level temporarily throttled the request.",
      retryAfterMs: 4_000,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("times out after the configured bound and reports a safe error", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const client = new LevelClient({
      apiKey: "test",
      fetcher,
      timeoutMs: 100,
      maxRetries: 0,
      logger: vi.fn(),
    });
    const pending = client.healthCheck({ correlationId });
    const assertion = expect(pending).rejects.toEqual(
      expect.objectContaining({ code: "timeout", message: "Level did not respond in time." }),
    );
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });

  it("rejects malformed successful responses without exposing the body", async () => {
    const client = new LevelClient({
      apiKey: "test",
      fetcher: async () => Response.json({ data: [{ password: "private" }], has_more: "yes" }),
      logger: vi.fn(),
    });
    await expect(client.healthCheck({ correlationId })).rejects.toEqual(
      new LevelClientError("malformed_response", "Level returned an invalid response."),
    );
  });

  it("paginates with the documented starting_after cursor", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: [{ id: "device-1" }], has_more: true }))
      .mockResolvedValueOnce(Response.json({ data: [{ id: "device-2" }], has_more: false }));
    const client = new LevelClient({ apiKey: "test", fetcher, logger: vi.fn() });
    const ids: string[] = [];
    for await (const device of client.paginateDevices({ correlationId, pageSize: 100 }))
      ids.push(device.id);
    expect(ids).toEqual(["device-1", "device-2"]);
    expect(String(fetcher.mock.calls[1]![0])).toContain("limit=100&starting_after=device-1");
  });
});
