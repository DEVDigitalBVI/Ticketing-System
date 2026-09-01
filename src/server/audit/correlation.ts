import "server-only";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requestCorrelationId(request: Request) {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && uuidPattern.test(supplied) ? supplied : crypto.randomUUID();
}
