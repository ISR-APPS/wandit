import { logger, metadata, schemaTask, timeout, wait } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { parseOrderRefundPayload } from "../modules/orders/application/refunds/order-refund.contracts";
import { assertOrderRefundConfiguration } from "./domain-operations.config";
import { orderRefundsQueue } from "./domain-task-queues";
import { createOrderRefundRuntime } from "./order-refund.runtime";

/**
 * Independently durable money-recovery task. Application/provider failures are
 * handled by OrderRefundRunner's checkpointed loop; task retries are reserved
 * for process/platform crashes around that loop.
 */
export const orderRefundTask = schemaTask({
	id: "order-refund",
	maxDuration: timeout.None,
	queue: orderRefundsQueue,
	retry: {
		factor: 1,
		maxAttempts: 5,
		maxTimeoutInMs: 60_000,
		minTimeoutInMs: 60_000,
		randomize: false,
	},
	schema: parseOrderRefundPayload,
	run: async (payload, { ctx }) => {
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

		try {
			metadata.set("orderId", payload.orderId).set("stage", "refunding");

			const runtime = createOrderRefundRuntime(db, {
				beforeAttempt: assertOrderRefundConfiguration,
				logger: {
					error(message, context) {
						logger.error(message, { ...context });
					},
				},
				wait: {
					for: (input) => wait.for(input),
				},
			});
			const result = await runtime.runner.run(payload);

			metadata.set("stage", result.processed ? "processed" : "stale");
			logger.info("Order refund task completed", {
				orderId: payload.orderId,
				processed: result.processed,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
