const sensitiveKey =
  /(?:authorization|cookie|password|credential|secret|token|api[_-]?key|file[_-]?url|private[_-]?comment|provider[_-]?payload|raw[_-]?payload|request[_-]?body|response[_-]?body|headers?)/i;
const urlPattern = /https?:\/\/[^\s"']+/gi;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const bearerPattern = /\b(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]+/gi;
const secretAssignmentPattern = /\b(?:password|secret|token|api[_-]?key)=([^\s&]+)/gi;

function redactString(value: string) {
  return value
    .replace(bearerPattern, "[redacted-credential]")
    .replace(secretAssignmentPattern, "[redacted-secret]")
    .replace(urlPattern, "[redacted-url]")
    .replace(emailPattern, "[redacted-email]")
    .slice(0, 500);
}

export function redactOperationalValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[redacted-depth]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return redactString(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value))
    return value.slice(0, 20).map((item) => redactOperationalValue(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 40)
        .map(([key, item]) => [
          key,
          sensitiveKey.test(key) ? "[redacted]" : redactOperationalValue(item, depth + 1),
        ]),
    );
  }
  return "[redacted-type]";
}

export function safeErrorCode(value: unknown, fallback = "operation_failed") {
  if (typeof value !== "string") return fallback;
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, "_")
      .slice(0, 80) || fallback
  );
}
