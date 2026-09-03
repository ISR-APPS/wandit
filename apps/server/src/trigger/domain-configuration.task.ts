import { logger, metadata, schemaTask, wait } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { parseDomainConfigurationPayload } from "../modules/domains/application/fulfillment/domain-fulfillment.contracts";
import { createDomainConfigurationRuntime } from "./domain-fulfillment.runtime";
import { assertDomainConfigurationConfiguration } from "./domain-operations.config";
import { domainOperationsQueue } from "./domain-task-queues";

/**
 * Durable custom-hostname verification for BYO attach and manual checks, plus
 * the ownership-gated best-effort apex zone pass after each external probe.
 */
export const domainConfigurationTask = schemaTask({
	id: "domain-configure",
	queue: domainOperationsQueue,
	retry: {
		factor: 2,
		maxAttempts: 3,
		maxTimeoutInMs: 120_000,
		minTimeoutInMs: 60_000,
		randomize: false,
	},
	schema: parseDomainConfigurationPayload,
	run: async (payload, { ctx }) => {
		// Deliberately before pool/runtime construction and any provider call.
		const configuration = assertDomainConfigurationConfiguration();
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

		try {
			metadata
				.set("domainId", payload.domainId)
				.set("configurationNonce", payload.nonce)
				.set("stage", "verifying");

			const runtime = createDomainConfigurationRuntime(db, {
				apexZoneEnabled: configuration.apexZoneEnabled,
				fallbackOrigin: configuration.fallbackOrigin,
				logger: triggerLogger,
				wait: {
					until: (input) => wait.until(input),
				},
			});
			const result = await runtime.configuration.execute(payload);

			metadata.set("stage", result.processed ? "active" : result.reason);
			logger.info("Domain configuration task completed", {
				domainId: payload.domainId,
				result,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});

const triggerLogger = {
	error(message: string, details?: unknown) {
		logger.error(message, { details });
	},
	warn(message: string, details?: unknown) {
		logger.warn(message, { details });
	},
};
