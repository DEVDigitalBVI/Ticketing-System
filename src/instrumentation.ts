import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getPublicEnvironment } = await import("@/config/public");
  const { getServerEnvironment } = await import("@/config/server");
  getPublicEnvironment();
  getServerEnvironment();
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { writeOperationalLog } = await import("@/server/observability/logger");
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest).slice(0, 120)
      : undefined;
  writeOperationalLog({
    severity: "error",
    component: "next-server",
    event: "request_unhandled_error",
    correlationId: Array.isArray(request.headers["x-request-id"])
      ? request.headers["x-request-id"][0]
      : request.headers["x-request-id"],
    errorCode: "request_unhandled_error",
    context: {
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      routerKind: context.routerKind,
      errorType: error instanceof Error ? error.name : "UnknownError",
      digest,
    },
  });
};
