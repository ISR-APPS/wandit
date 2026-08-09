import { logger, schedules, schemaTask } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";
import { z } from "zod";

import { assertBillingDatabaseConfiguration } from "./billing-maintenance.config";
import { createSignupGrantRuntime } from "./billing-maintenance.runtime";
import { billingFinancialQueue } from "./billing-task-queues";

export const signupGrantOutboxSweepTask = schedules.task({
	id: "signup-grant-outbox-sweep",
	cron: { pattern: "*/5 * * * *", timezone: "UTC" },
	maxDuration: 240,
	queue: billingFinancialQueue,
	retry: {
		factor: 2,
		maxAttempts: 3,
		maxTimeoutInMs: 30_000,
		minTimeoutInMs: 5_000,
		randomize: false,
	},
	ttl: "4m",
	run: async (_payload, { ctx }) => runSweep(undefined, ctx.run.id),
});

/** Best-effort fast path after the inline signup grant left a pending row. */
export const signupGrantDeliveryTask = schemaTask({
	id: "signup-grant-outbox-delivery",
	maxDuration: 120,
	queue: billingFinancialQueue,
	retry: {
		factor: 2,
		maxAttempts: 3,
		maxTimeoutInMs: 30_000,
		minTimeoutInMs: 5_000,
		randomize: false,
	},
	schema: z.object({ userId: z.string().min(1) }),
	run: async ({ userId }, { ctx }) => runSweep(userId, ctx.run.id),
});

async function runSweep(
	userId: string | undefined,
	triggerRunId: string,
): Promise<{ done: number }> {
	assertBillingDatabaseConfiguration();
	const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

	try {
		const runtime = createSignupGrantRuntime(db);
		const result = await runtime.outbox.sweep(userId);

		if (result.failed > 0) {
			throw new Error(
				`Signup grant outbox sweep left ${result.failed} row(s) pending`,
			);
		}

		logger.info("Signup grant outbox sweep completed", {
			done: result.done,
			triggerRunId,
			...(userId ? { userId } : {}),
		});

		return { done: result.done };
	} finally {
		await db.$client.end();
	}
}
