import * as Sentry from "@sentry/node";

import {
	dropHealthchecks,
	isEnabled,
	scrubEvent,
	type WanditSentryOptions,
} from "./internal/shared";

/**
 * The full `@sentry/node` API. Also the import to use for explicit captures
 * in code shared between runtimes (Nest services that also run inside worker
 * or Trigger processes) — capture functions bind to whichever client the
 * running process initialized.
 */
export * as Sentry from "@sentry/node";

export interface InitNodeSentryOptions extends WanditSentryOptions {
	runtime: string;
}

/**
 * Initialize Sentry for a plain Node process (apps/worker). Must be the
 * first import of the entry file. No-op when no DSN is configured.
 */
export function initNodeSentry(options: InitNodeSentryOptions): void {
	if (!isEnabled(options)) {
		return;
	}
	Sentry.init({
		dsn: options.dsn,
		environment: options.environment,
		release: options.release,
		sendDefaultPii: false,
		enableLogs: true,
		integrations: [
			Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
		],
		tracesSampler: dropHealthchecks(options.tracesSampleRate ?? 0.1),
		beforeSend: scrubEvent,
		initialScope: { tags: { runtime: options.runtime } },
	});
}
