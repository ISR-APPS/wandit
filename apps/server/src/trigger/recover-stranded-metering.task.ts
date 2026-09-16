/**
 * Scheduled sweep (every 15 minutes) that refunds stale reservation holds and
 * reconciles ref-bearing rows. Runs `recoverStaleReservations` through the
 * trigger metering runtime.
 */
import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { staleAfterMsFor } from "../modules/metering/domain/stale-reservation-window";
import {
	assertMeteringRecoveryConfiguration,
	meteringGatewayConfigurationError,
} from "./billing-maintenance.config";
import { meteringMaintenanceQueue } from "./billing-task-queues";
import { triggerAnalytics } from "./init";
import { createTriggerMeteringRecovery } from "./metering.runtime";

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
			// Builder turns get the 90-minute window. A turn can run 60 minutes,
			// so the 40-minute cutoff would refund a live hold. "chat" stands for
			// every non-agent operation, and the metering query still grants
			// extra time to a running Personal Clipper job.
			const reservations = await runtime.metering.recoverStaleReservations(
				new Date(payload.timestamp.getTime() - staleAfterMsFor("chat")),
				RECOVERY_BATCH_LIMIT,
				payload.timestamp,
				{
					agentSessionCreatedBefore: new Date(
						payload.timestamp.getTime() - staleAfterMsFor("agent_session"),
					),
					reconcileRefs: gatewayConfigurationError === null,
				},
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
