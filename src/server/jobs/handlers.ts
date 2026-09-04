import { JobExecutionError } from "@/server/jobs/policy";
import type { JobHandlers } from "@/server/jobs/types";

export const jobHandlers: JobHandlers = {
  "synthetic.noop": async (job) => ({ synthetic: true, jobId: job.id }),
  "sla.evaluate": async (job) => ({ evaluated: true, jobId: job.id }),
  "notification.dispatch": async () => {
    throw new JobExecutionError(
      "provider_not_configured",
      "Notification provider is not configured.",
    );
  },
  "synchronization.run": async () => {
    throw new JobExecutionError(
      "provider_not_configured",
      "Synchronization provider is not configured.",
    );
  },
  "webhook.process": async () => {
    throw new JobExecutionError("provider_not_configured", "Webhook provider is not configured.");
  },
};
