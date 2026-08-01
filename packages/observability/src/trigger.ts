import * as Sentry from "@sentry/node";
import { tasks } from "@trigger.dev/sdk";

import { isEnabled, type WanditSentryOptions } from "./internal/shared";

/**
 * Sentry for the Trigger.dev runtime — a separate deployed process that never
 * boots Nest, so the server's instrument.ts does not cover it. Call from
 * apps/server/src/trigger/init.ts (auto-loaded before any task executes).
 *
 * `defaultIntegrations: false`: Trigger runs its own OpenTelemetry runtime
 * for the run dashboard — letting Sentry patch modules on top of it would
 * double-instrument. Sentry here is errors-only by design; the run trace
 * stays in the Trigger dashboard.
 *
 * `tasks.onFailure` fires once per run after retries are exhausted, so Sentry
 * gets one event per genuinely failed run, tagged with run/task ids to jump
 * back to the Trigger dashboard.
 */
export function initTriggerSentry(options: WanditSentryOptions): void {
	if (!isEnabled(options)) {
		return;
	}
	Sentry.init({
		defaultIntegrations: false,
		// defaultIntegrations alone does NOT stop @sentry/node from installing
		// its own OTel provider/context manager — which would fight the OTel
		// runtime Trigger.dev owns. This does.
		skipOpenTelemetrySetup: true,
		dsn: options.dsn,
		environment: options.environment,
		release: options.release,
		sendDefaultPii: false,
	});
	tasks.onFailure(({ payload, error, ctx }) => {
		Sentry.withScope((scope) => {
			scope.setTag("runtime", "trigger");
			scope.setTag("trigger.task", ctx.task.id);
			scope.setContext("trigger", {
				runId: ctx.run.id,
				taskId: ctx.task.id,
				attempt: ctx.attempt.number,
			});
			scope.setExtra("payload", payload);
			Sentry.captureException(error);
		});
	});
	// Runs after success AND failure. The flush lives here, not in onFailure:
	// runner code captures provider errors and then RETURNS {status:"failed"}
	// (a successful run to Trigger), and the process can be torn down right
	// after — without this flush those events never leave the machine.
	tasks.onComplete(async () => {
		await Sentry.flush(2000);
	});
}
