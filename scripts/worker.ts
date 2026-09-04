import "dotenv/config";

import { hostname } from "node:os";

import { database } from "@/server/database/client";
import { DatabaseJobStore } from "@/server/jobs/database-store";
import { jobHandlers } from "@/server/jobs/handlers";
import { writeJobLog } from "@/server/jobs/logging";
import { runWorkerLoop } from "@/server/jobs/worker";

const shutdown = new AbortController();
const workerId = `${hostname()}:${process.pid}`;

function requestShutdown(signal: string) {
  writeJobLog({ event: "worker_shutdown_requested", status: "interrupted" });
  shutdown.abort(signal);
}

process.once("SIGINT", () => requestShutdown("SIGINT"));
process.once("SIGTERM", () => requestShutdown("SIGTERM"));

try {
  await database.$connect();
  writeJobLog({ event: "worker_started" });
  await runWorkerLoop({
    store: new DatabaseJobStore(),
    handlers: jobHandlers,
    workerId,
    signal: shutdown.signal,
  });
} catch {
  writeJobLog({ event: "worker_failed", errorCode: "worker_runtime_failed" });
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
