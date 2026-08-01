/**
 * Shared pieces for every runtime entry point. Not exported from the package —
 * apps import the runtime file that matches where their code runs
 * (`/nestjs`, `/node`, `/browser`, `/cloudflare`, `/trigger`).
 */

/** Common options every `init*Sentry` accepts. No DSN means Sentry stays off. */
export interface WanditSentryOptions {
	dsn?: string;
	environment?: string;
	release?: string;
	tracesSampleRate?: number;
}

export const isEnabled = (options: WanditSentryOptions): boolean =>
	Boolean(options.dsn);

const SENSITIVE_HEADERS = [
	"authorization",
	"cookie",
	"set-cookie",
	"x-api-key",
];

/**
 * Structural subset of Sentry's event shape — keeps this file free of SDK
 * imports so each entry point only pulls in its own runtime's SDK.
 */
interface ScrubbableEvent {
	request?: {
		cookies?: unknown;
		headers?: Record<string, string>;
	};
}

/**
 * `beforeSend` used by every runtime: better-auth session cookies and auth
 * headers must never ride along on error events.
 */
export const scrubEvent = <E extends ScrubbableEvent>(event: E): E => {
	if (event.request) {
		event.request.cookies = undefined;
		const headers = event.request.headers;
		if (headers) {
			for (const key of Object.keys(headers)) {
				if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
					delete headers[key];
				}
			}
		}
	}
	return event;
};

/**
 * `tracesSampler` factory: drops health-check noise, honors the sampling
 * decision of the calling service (so a sampled SPA pageload keeps its API
 * spans and an unsampled one doesn't create orphans), otherwise applies
 * the configured rate.
 */
export const dropHealthchecks =
	(rate: number) =>
	(samplingContext: {
		name: string;
		parentSampled?: boolean;
	}): number | boolean => {
		if (samplingContext.name.includes("/health")) {
			return 0;
		}
		if (typeof samplingContext.parentSampled === "boolean") {
			return samplingContext.parentSampled;
		}
		return rate;
	};
