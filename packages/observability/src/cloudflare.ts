/** The full `@sentry/cloudflare` API, including `withSentry`. */
export * as Sentry from "@sentry/cloudflare";

export interface EdgeSentryEnv {
	SENTRY_DSN?: string;
	SENTRY_ENVIRONMENT?: string;
}

/**
 * Options factory for `Sentry.withSentry((env) => edgeSentryOptions(env), handler)`.
 * The Worker cannot read process.env — options come from its `Env` bindings.
 * An unset DSN leaves the SDK disabled (local `wrangler dev`).
 *
 * Requires the `nodejs_als` compatibility flag in wrangler config (the SDK
 * needs AsyncLocalStorage), mirrored in wrangler.jsonc AND wrangler.dev.jsonc.
 */
export function edgeSentryOptions(env: EdgeSentryEnv) {
	return {
		dsn: env.SENTRY_DSN,
		environment: env.SENTRY_ENVIRONMENT ?? "production",
		sendDefaultPii: false,
		// Published-site traffic is the highest-volume surface — sample low.
		tracesSampleRate: 0.1,
	};
}
