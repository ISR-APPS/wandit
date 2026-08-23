import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { SETTLED_RECONCILIATION_PENDING_MAX_AGE_MS } from "../modules/metering/application/services/metering.service";
import { assertMeteringConfiguration } from "./billing-maintenance.config";
import { meteringMaintenanceQueue } from "./billing-task-queues";
import { createTriggerMetering } from "./metering.runtime";

const RECONCILIATION_GRACE_MS = 60_000;
const RECONCILIATION_BATCH_LIMIT = 500;
const RETRY_BATCH_LIMIT = 100;

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
			const settled = await metering.recoverUnreconciledSettled(
				new Date(payload.timestamp.getTime() - RECONCILIATION_GRACE_MS),
				RECONCILIATION_BATCH_LIMIT,
				payload.timestamp,
			);
			// Second pass: due reconcile_failed retries (bounded backoff).
			const retries = await metering.retryFailedReconciliations(
				payload.timestamp,
				RETRY_BATCH_LIMIT,
			);
			// Third pass: settled events with zero refs, old enough that late ref
			// capture has had every chance to win first.
			const settledWithoutRefs = await metering.recoverSettledWithoutRefs(
				new Date(
					payload.timestamp.getTime() -
						SETTLED_RECONCILIATION_PENDING_MAX_AGE_MS,
				),
				RETRY_BATCH_LIMIT,
			);
			const result = { retries, settled, settledWithoutRefs };

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
