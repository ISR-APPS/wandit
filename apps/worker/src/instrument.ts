/**
 * Sentry bootstrap for the worker. MUST stay the first import of main.ts so
 * OpenTelemetry patches ioredis/bullmq/pg before Nest loads them.
 *
 * With no SENTRY_DSN set (local dev) this is a no-op.
 */
import { env } from "@wandit/env/server";
import { initNodeSentry } from "@wandit/observability/node";

initNodeSentry({
	dsn: env.SENTRY_DSN,
	environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
	release: env.SENTRY_RELEASE,
	runtime: "worker",
});
