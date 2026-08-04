import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { assertMeteringConfiguration } from "./billing-maintenance.config";
import { meteringMaintenanceQueue } from "./billing-task-queues";
import { createTriggerMetering } from "./metering.runtime";

const RECONCILIATION_GRACE_MS = 60_000;
const RECONCILIATION_BATCH_LIMIT = 500;

/** One run batches every selected event; there is never one Trigger run/ref. */
export const meteringReconciliationSweepTask = schedules.task({
	id: "metering-reconciliation-sweep",
	cron: { pattern: "* * * * *", timezone: "UTC" },
	maxDuration: 240,
	queue: meteringMaintenanceQueue,
	retry: { maxAttempts: 1 },
	ttl: "50s",
	run: async (payload, { ctx }) => {
		assertMeteringConfiguration();
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

		try {
			const metering = createTriggerMetering(db);
			const result = await metering.recoverUnreconciledSettled(
				new Date(payload.timestamp.getTime() - RECONCILIATION_GRACE_MS),
				RECONCILIATION_BATCH_LIMIT,
				payload.timestamp,
			);

			logger.info("Batched metering reconciliation completed", {
				...result,
				batchLimit: RECONCILIATION_BATCH_LIMIT,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
