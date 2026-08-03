import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { assertMeteringConfiguration } from "./billing-maintenance.config";
import { meteringMaintenanceQueue } from "./billing-task-queues";
import { triggerAnalytics } from "./init";
import { createTriggerMeteringRecovery } from "./metering.runtime";

// Connector tasks may wait 5m and execute for 30m. Keep another 5m before a
// generic reservation refund can compete with a delayed completion write.
const RESERVATION_STALE_AFTER_MS = 40 * 60_000;
const RECOVERY_BATCH_LIMIT = 100;

export const strandedMeteringRecoveryTask = schedules.task({
	id: "metering-stranded-reservation-recovery",
	cron: { pattern: "*/15 * * * *", timezone: "UTC" },
	maxDuration: 240,
	queue: meteringMaintenanceQueue,
	retry: { maxAttempts: 1 },
	ttl: "14m",
	run: async (payload, { ctx }) => {
		assertMeteringConfiguration();
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

		try {
			const runtime = createTriggerMeteringRecovery(db, triggerAnalytics);
			// Checkpoint repair must precede generic stale refund: a connector parent
			// can be ref-less while its child/provider output is already durable.
			const connectors =
				await runtime.connectorRecovery.recoverCompletionCheckpoints();
			const reservations = await runtime.metering.recoverStaleReservations(
				new Date(payload.timestamp.getTime() - RESERVATION_STALE_AFTER_MS),
				RECOVERY_BATCH_LIMIT,
				payload.timestamp,
			);
			const result = { connectors, reservations };

			logger.info("Stranded metering reservation recovery completed", {
				connectors,
				reservations,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
