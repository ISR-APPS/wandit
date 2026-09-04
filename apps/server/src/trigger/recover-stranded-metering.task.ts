import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import {
	assertMeteringRecoveryConfiguration,
	meteringGatewayConfigurationError,
} from "./billing-maintenance.config";
import { meteringMaintenanceQueue } from "./billing-task-queues";
import { triggerAnalytics } from "./init";
import { createTriggerMeteringRecovery } from "./metering.runtime";

// Keep the generic reservation window unchanged. The metering query grants a
// longer window only to reservations tied to a running Personal Clipper job.
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
		// Database-only gate: refunding a ref-less hold never contacts a gateway,
		// and a missing gateway key must not stop refunds from running. Reconciling
		// ref-bearing rows does need a key, so that half degrades to a reported
		// skip instead of a throw.
		assertMeteringRecoveryConfiguration();
		const gatewayConfigurationError = meteringGatewayConfigurationError();

		if (gatewayConfigurationError) {
			logger.warn(
				"Stranded metering recovery runs refund-only; ref-bearing rows are skipped",
				{ reason: gatewayConfigurationError.message },
			);
		}

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
				{ reconcileRefs: gatewayConfigurationError === null },
			);
			const result = {
				connectors,
				reservations,
				...(gatewayConfigurationError === null
					? {}
					: { skippedReconcileReason: gatewayConfigurationError.message }),
			};

			logger.info("Stranded metering reservation recovery completed", {
				...result,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
