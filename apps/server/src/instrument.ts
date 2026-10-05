/**
 * Sentry bootstrap. MUST stay the first import of main.ts: Sentry's
 * OpenTelemetry layer patches http/fastify/db modules at import time, so it
 * has to run before @nestjs/core or Fastify are ever loaded.
 * The harness host preloads this file too (`start:host` in package.json).
 *
 * With no SENTRY_DSN set (local dev) this is a no-op.
 */
import { basename, dirname } from "node:path";

import { env } from "@wandit/env/server";
import { initNestSentry } from "@wandit/observability/nestjs";

// The host and the API share this preload. The entry path tells their events
// apart: `start:host` runs dist/harness-host/main.mjs.
const isHarnessHost =
	basename(dirname(process.argv[1] ?? "")) === "harness-host";

initNestSentry({
	dsn: env.SENTRY_DSN,
	environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
	release: env.SENTRY_RELEASE,
	runtime: isHarnessHost ? "harness-host" : "server",
});
