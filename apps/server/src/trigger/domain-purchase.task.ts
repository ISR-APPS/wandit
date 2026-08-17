import {
	AbortTaskRunError,
	logger,
	metadata,
	schemaTask,
	wait,
} from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import {
	type DomainPurchasePayload,
	parseDomainPurchasePayload,
} from "../modules/domains/application/fulfillment/domain-fulfillment.contracts";
import {
	createDomainFailureRuntime,
	createDomainPurchaseRuntime,
} from "./domain-fulfillment.runtime";
import {
	assertDatabaseConfiguration,
	assertDomainPurchaseConfiguration,
} from "./domain-operations.config";
import { domainOperationsQueue } from "./domain-task-queues";

/**
 * Purchased-domain composition wrapper. Provider/state-machine behavior stays
 * in the Stage 1 services; this file owns task policy, durable wait adaptation,
 * and the controlled final-attempt/onFailure backstops.
 */
export const domainPurchaseTask = schemaTask({
	id: "domain-purchase",
	maxDuration: 1800,
	queue: domainOperationsQueue,
	retry: {
		factor: 2,
		maxAttempts: 5,
		maxTimeoutInMs: 480_000,
		minTimeoutInMs: 60_000,
		randomize: false,
	},
	schema: parseDomainPurchasePayload,
	onFailure: async ({ payload, error }) => {
		await finalizePurchaseFromHook(payload, error);
	},
	run: async (payload, { ctx }) => {
		let db: ReturnType<typeof createDb> | null = null;
		let runtime: ReturnType<typeof createDomainPurchaseRuntime> | null = null;

		try {
			// The full purchase preflight is intentionally the first operation.
			const configuration = assertDomainPurchaseConfiguration();

			db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
			metadata
				.set("domainId", payload.domainId)
				.set("orderId", payload.orderId)
				.set("stage", "fulfilling");

			runtime = createDomainPurchaseRuntime(db, {
				apexZoneEnabled: configuration.apexZoneEnabled,
				fallbackOrigin: configuration.fallbackOrigin,
				logger: triggerLogger,
				wait: {
					until: (input) => wait.until(input),
				},
			});
			const result = await runtime.purchase.execute(payload);

			metadata.set("stage", result.processed ? "active" : result.reason);
			logger.info("Domain purchase task completed", {
				domainId: payload.domainId,
				orderId: payload.orderId,
				result,
				triggerRunId: ctx.run.id,
			});

			if (result.terminalized) {
				throw new AbortTaskRunError(
					`Domain purchase reached terminal result ${result.reason}`,
				);
			}

			return result;
		} catch (error) {
			if (!(error instanceof AbortTaskRunError) && ctx.attempt.number >= 5) {
				if (!db) {
					// Other feature credentials may be the failure. Only DB access is
					// needed to persist/refund the controlled terminal outcome.
					assertDatabaseConfiguration();
					db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
				}

				const finalizer =
					runtime ?? createDomainFailureRuntime(db, triggerLogger);

				await finalizer.finalizePurchase(payload, error);
			}

			throw error;
		} finally {
			if (db) {
				await db.$client.end();
			}
		}
	},
});

async function finalizePurchaseFromHook(
	payload: DomainPurchasePayload,
	error: unknown,
): Promise<void> {
	assertDatabaseConfiguration();
	const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

	try {
		const runtime = createDomainFailureRuntime(db, triggerLogger);

		await runtime.finalizePurchase(payload, error);
	} finally {
		await db.$client.end();
	}
}

const triggerLogger = {
	error(message: string, details?: unknown) {
		logger.error(message, { details });
	},
	warn(message: string, details?: unknown) {
		logger.warn(message, { details });
	},
};
