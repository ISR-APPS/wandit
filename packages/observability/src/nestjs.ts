import * as Sentry from "@sentry/nestjs";

import {
	dropHealthchecks,
	isEnabled,
	scrubEvent,
	type WanditSentryOptions,
} from "./internal/shared";

/**
 * The full `@sentry/nestjs` API, for explicit captures at call sites.
 *
 * SentryModule/SentryNestLogger live in ./nestjs-setup, NOT here: that module
 * imports @nestjs/common, and this one is evaluated by the instrument preload,
 * which must never load Nest before Sentry.init has run.
 */
export * as Sentry from "@sentry/nestjs";

export interface InitNestSentryOptions extends WanditSentryOptions {
	runtime: "server";
}

/**
 * Initialize Sentry for the NestJS API. Must run before `@nestjs/core` or
 * Fastify are imported (see apps/server/src/instrument.ts) so OpenTelemetry
 * can patch http/fastify/db modules. No-op when no DSN is configured.
 */
export function initNestSentry(options: InitNestSentryOptions): void {
	if (!isEnabled(options)) {
		return;
	}
	Sentry.init({
		dsn: options.dsn,
		environment: options.environment,
		release: options.release,
		sendDefaultPii: false,
		// Nest's Logger writes to console — warn/error become Sentry logs
		// with zero call-site changes. Never widen to log/info: 5GB/mo quota.
		enableLogs: true,
		integrations: [
			Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
			// AI Agent Monitoring: auto-instruments AI SDK calls (ToolLoopAgent,
			// generateText, tool calls) with token counts. recordInputs/Outputs
			// puts prompts into spans — flip to false if that becomes sensitive.
			Sentry.vercelAIIntegration({ recordInputs: true, recordOutputs: true }),
		],
		tracesSampler: dropHealthchecks(options.tracesSampleRate ?? 0.2),
		beforeSend: scrubEvent,
		initialScope: { tags: { runtime: options.runtime } },
	});
}
