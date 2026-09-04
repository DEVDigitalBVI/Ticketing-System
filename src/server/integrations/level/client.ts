import "server-only";

import { z } from "zod";

const levelDeviceSchema = z
  .object({
    id: z.string().trim().min(1),
    hostname: z.string().nullable().optional(),
    serial_number: z.string().nullable().optional(),
    manufacturer: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    platform: z.string().nullable().optional(),
    group_id: z.string().nullable().optional(),
    online: z.boolean().optional(),
    last_seen_at: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .passthrough();

const devicePageSchema = z.object({
  data: z.array(levelDeviceSchema),
  has_more: z.boolean(),
});

export type LevelDevice = z.infer<typeof levelDeviceSchema>;
export type LevelDevicePage = z.infer<typeof devicePageSchema>;
export type LevelClientErrorCode =
  | "authentication_failed"
  | "permission_denied"
  | "throttled"
  | "timeout"
  | "network_failed"
  | "malformed_response"
  | "upstream_failed";

export class LevelClientError extends Error {
  constructor(
    readonly code: LevelClientErrorCode,
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "LevelClientError";
  }
}

type SafeLevelLog = {
  event: "request_succeeded" | "request_retry" | "request_failed";
  operation: "list_devices";
  correlationId: string;
  attempt: number;
  status?: number;
  durationMs?: number;
  errorCode?: LevelClientErrorCode;
  retryAfterMs?: number;
};

type LevelClientOptions = {
  apiKey: string;
  fetcher?: typeof fetch;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  now?: () => Date;
  logger?: (entry: SafeLevelLog) => void;
  timeoutMs?: number;
  maxRetries?: number;
  maximumRetryAfterMs?: number;
  baseUrl?: string;
};

function defaultLogger(entry: SafeLevelLog) {
  console.info(JSON.stringify({ component: "level-client", ...entry }));
}

function defaultSleep(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, milliseconds);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

function retryAfterMilliseconds(value: string | null, now: Date) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now.getTime()) : null;
}

export class LevelClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;
  private readonly sleep: NonNullable<LevelClientOptions["sleep"]>;
  private readonly now: NonNullable<LevelClientOptions["now"]>;
  private readonly logger: NonNullable<LevelClientOptions["logger"]>;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly maximumRetryAfterMs: number;
  private readonly baseUrl: URL;

  constructor(options: LevelClientOptions) {
    if (!options.apiKey.trim()) throw new Error("A Level API key is required.");
    this.apiKey = options.apiKey;
    this.fetcher = options.fetcher ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? (() => new Date());
    this.logger = options.logger ?? defaultLogger;
    this.timeoutMs = Math.min(Math.max(options.timeoutMs ?? 5_000, 100), 30_000);
    this.maxRetries = Math.min(Math.max(options.maxRetries ?? 2, 0), 4);
    this.maximumRetryAfterMs = Math.min(Math.max(options.maximumRetryAfterMs ?? 30_000, 0), 60_000);
    this.baseUrl = new URL(options.baseUrl ?? "https://api.level.io");
    if (this.baseUrl.protocol !== "https:" && this.baseUrl.hostname !== "localhost")
      throw new Error("The Level API base URL must use HTTPS.");
  }

  async listDevicePage(input: {
    correlationId: string;
    limit?: number;
    startingAfter?: string;
    signal?: AbortSignal;
  }): Promise<LevelDevicePage> {
    const url = new URL("/v2/devices", this.baseUrl);
    url.searchParams.set("limit", String(Math.min(Math.max(input.limit ?? 100, 1), 100)));
    if (input.startingAfter) url.searchParams.set("starting_after", input.startingAfter);
    return this.requestDevicePage(url, input.correlationId, input.signal);
  }

  async *paginateDevices(input: {
    correlationId: string;
    pageSize?: number;
    maximumPages?: number;
    signal?: AbortSignal;
  }): AsyncGenerator<LevelDevice, void> {
    const maximumPages = Math.min(Math.max(input.maximumPages ?? 100, 1), 1_000);
    let startingAfter: string | undefined;
    const cursors = new Set<string>();
    for (let pageNumber = 0; pageNumber < maximumPages; pageNumber += 1) {
      const page = await this.listDevicePage({
        correlationId: input.correlationId,
        limit: input.pageSize,
        startingAfter,
        signal: input.signal,
      });
      for (const device of page.data) yield device;
      if (!page.has_more) return;
      const cursor = page.data.at(-1)?.id;
      if (!cursor || cursors.has(cursor))
        throw new LevelClientError("malformed_response", "Level returned invalid pagination data.");
      cursors.add(cursor);
      startingAfter = cursor;
    }
    throw new LevelClientError("malformed_response", "Level pagination exceeded the safe limit.");
  }

  async healthCheck(input: { correlationId: string; signal?: AbortSignal }) {
    const startedAt = Date.now();
    await this.listDevicePage({
      correlationId: input.correlationId,
      limit: 1,
      signal: input.signal,
    });
    return {
      healthy: true as const,
      checkedAt: this.now(),
      latencyMs: Math.max(0, Date.now() - startedAt),
      capability: "read_devices" as const,
    };
  }

  private async requestDevicePage(url: URL, correlationId: string, signal?: AbortSignal) {
    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt += 1) {
      const startedAt = Date.now();
      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(), this.timeoutMs);
      const requestSignal = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal;
      let response: Response;
      try {
        response = await this.fetcher(url, {
          method: "GET",
          headers: { Accept: "application/json", Authorization: this.apiKey },
          cache: "no-store",
          signal: requestSignal,
        });
      } catch {
        clearTimeout(timer);
        const code: LevelClientErrorCode = timeout.signal.aborted ? "timeout" : "network_failed";
        if (attempt <= this.maxRetries && !signal?.aborted) {
          const delay = 250 * 2 ** (attempt - 1);
          this.logger({
            event: "request_retry",
            operation: "list_devices",
            correlationId,
            attempt,
            errorCode: code,
            retryAfterMs: delay,
          });
          await this.sleep(delay, signal);
          continue;
        }
        this.logger({
          event: "request_failed",
          operation: "list_devices",
          correlationId,
          attempt,
          errorCode: code,
        });
        throw new LevelClientError(
          code,
          code === "timeout" ? "Level did not respond in time." : "Level could not be reached.",
        );
      }
      if (response.ok) {
        try {
          const page = devicePageSchema.parse(await response.json());
          clearTimeout(timer);
          this.logger({
            event: "request_succeeded",
            operation: "list_devices",
            correlationId,
            attempt,
            status: response.status,
            durationMs: Date.now() - startedAt,
          });
          return page;
        } catch {
          clearTimeout(timer);
          if (timeout.signal.aborted)
            throw this.failure(
              "timeout",
              "Level did not respond in time.",
              correlationId,
              attempt,
              response.status,
            );
          this.logger({
            event: "request_failed",
            operation: "list_devices",
            correlationId,
            attempt,
            status: response.status,
            errorCode: "malformed_response",
          });
          throw new LevelClientError("malformed_response", "Level returned an invalid response.");
        }
      }

      clearTimeout(timer);

      if (response.status === 401)
        throw this.failure(
          "authentication_failed",
          "Level rejected the API key.",
          correlationId,
          attempt,
          response.status,
        );
      if (response.status === 403)
        throw this.failure(
          "permission_denied",
          "The Level key cannot read devices.",
          correlationId,
          attempt,
          response.status,
        );

      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt <= this.maxRetries && !signal?.aborted) {
        const suppliedDelay = retryAfterMilliseconds(
          response.headers.get("retry-after"),
          this.now(),
        );
        const delay = Math.min(suppliedDelay ?? 250 * 2 ** (attempt - 1), this.maximumRetryAfterMs);
        this.logger({
          event: "request_retry",
          operation: "list_devices",
          correlationId,
          attempt,
          status: response.status,
          retryAfterMs: delay,
        });
        await this.sleep(delay, signal);
        continue;
      }
      const code = response.status === 429 ? "throttled" : "upstream_failed";
      const delay =
        retryAfterMilliseconds(response.headers.get("retry-after"), this.now()) ?? undefined;
      throw this.failure(
        code,
        code === "throttled"
          ? "Level temporarily throttled the request."
          : "Level returned an unavailable response.",
        correlationId,
        attempt,
        response.status,
        delay,
      );
    }
    throw new LevelClientError("upstream_failed", "Level returned an unavailable response.");
  }

  private failure(
    code: LevelClientErrorCode,
    message: string,
    correlationId: string,
    attempt: number,
    status: number,
    retryAfterMs?: number,
  ) {
    this.logger({
      event: "request_failed",
      operation: "list_devices",
      correlationId,
      attempt,
      status,
      errorCode: code,
      retryAfterMs,
    });
    return new LevelClientError(code, message, retryAfterMs);
  }
}
