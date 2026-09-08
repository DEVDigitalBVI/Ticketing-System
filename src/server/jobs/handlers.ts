import { JobExecutionError } from "@/server/jobs/policy";
import type { JobHandlers } from "@/server/jobs/types";
import { runLevelInventorySync } from "@/server/integrations/level/inventory-sync";
import { processLevelWebhookJob } from "@/server/integrations/level/webhook-service";
import { runSlaHealthEvaluation } from "@/server/sla/health-jobs";

export const jobHandlers: JobHandlers = {
  "synthetic.noop": async (job) => ({ synthetic: true, jobId: job.id }),
  "sla.evaluate": async (job) => runSlaHealthEvaluation(job.organizationId),
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
  "synchronization.level_inventory": async (job, signal) => runLevelInventorySync({ job, signal }),
  "webhook.process": async () => {
    throw new JobExecutionError("provider_not_configured", "Webhook provider is not configured.");
  },
  "webhook.level.process": async (job) => processLevelWebhookJob(job),
};
