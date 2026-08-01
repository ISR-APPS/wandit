/**
 * Sentry bootstrap. MUST stay the first import of main.ts: Sentry's
 * OpenTelemetry layer patches http/fastify/db modules at import time, so it
 * has to run before @nestjs/core or Fastify are ever loaded.
 *
 * With no SENTRY_DSN set (local dev) this is a no-op.
 */
import { env } from "@wandit/env/server";
import { initNestSentry } from "@wandit/observability/nestjs";

initNestSentry({
	dsn: env.SENTRY_DSN,
	environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
	release: env.SENTRY_RELEASE,
	runtime: "server",
});
