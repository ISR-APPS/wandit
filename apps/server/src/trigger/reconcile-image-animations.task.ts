import { logger, queue, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { reconcileImageAnimations } from "../modules/media-generations/application/services/image-animation-reconciler";
import { createImageAnimationRuntime } from "./image-animation.runtime";
import { triggerAnalytics } from "./init";

const imageAnimationReconciliationQueue = queue({
	concurrencyLimit: 1,
	name: "image-animation-reconciliation",
});

/**
 * Backstop for run statuses where Trigger onFailure is not guaranteed
 * (crashed/system/canceled), lost API handoffs, and a failed attempt whose
 * idempotent ledger refund hit a transient error.
 */
export const reconcileImageAnimationsTask = schedules.task({
	id: "reconcile-image-animations",
	cron: "*/5 * * * *",
	maxDuration: 240,
	queue: imageAnimationReconciliationQueue,
	retry: {
		factor: 2,
		maxAttempts: 8,
		maxTimeoutInMs: 60_000,
		minTimeoutInMs: 5_000,
		randomize: true,
	},
	// Never queue multiple stale cron ticks behind an unhealthy reconciliation
	// run. The current/next tick plus task retries are the durable delivery.
	ttl: "4m",
	run: async (_payload, { ctx }) => {
		const db = createDb();

		try {
			const runtime = createImageAnimationRuntime(db, triggerAnalytics);
			const result = await reconcileImageAnimations(runtime.reconciler);

			logger.info("Image animation reconciliation completed", {
				...result,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
