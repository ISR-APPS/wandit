/**
 * Auto-loaded by Trigger.dev before any task in this directory executes.
 * The Trigger runtime never boots Nest, so the API's instrument.ts does not
 * cover it — this is its own Sentry entry point (errors-only; the run trace
 * lives in the Trigger dashboard).
 */
import { tasks } from "@trigger.dev/sdk";
import { createNodeAnalytics } from "@wandit/analytics/node";
import { env } from "@wandit/env/server";
import { initTriggerSentry } from "@wandit/observability/trigger";

initTriggerSentry({
	dsn: env.SENTRY_DSN,
	environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
	release: env.SENTRY_RELEASE,
});

export const triggerAnalytics = createNodeAnalytics({
	environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
	flushImmediately: true,
	host: env.POSTHOG_HOST,
	key: env.POSTHOG_KEY,
});

// Trigger workers stay warm across runs, so drain and flush without closing the
// shared client. Lifecycle-hook failures are isolated by Trigger from task outcomes.
tasks.onComplete("flush-analytics", async () => {
	await triggerAnalytics.flush();
});
