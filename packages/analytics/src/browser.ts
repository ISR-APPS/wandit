/**
 * PostHog in the browser: init with session replay, identify, reset, and event capture.
 * apps/web/src/main.tsx calls `initBrowserAnalytics`; web features call the other exports.
 * It calls posthog-js and the URL sanitizers of ./internal/shared.
 */
import posthog, { type BeforeSendFn } from "posthog-js";

import {
	DEFAULT_POSTHOG_HOST,
	sanitizeUrlProperties,
	type WanditAnalyticsOptions,
} from "./internal/shared";

let initialized = false;

const sanitizeBeforeSend: BeforeSendFn = (event) => {
	if (event === null) {
		return null;
	}

	event.properties = sanitizeUrlProperties(event.properties);
	if (event.$set) {
		event.$set = sanitizeUrlProperties(event.$set);
	}
	if (event.$set_once) {
		event.$set_once = sanitizeUrlProperties(event.$set_once);
	}

	return event;
};

/**
 * True for a URL on a preview host. Production and staging use this one domain.
 * The `f-` frame host label is a bearer secret for a whole run (apps/preview-proxy/README.md).
 */
function isPreviewUrl(url: string): boolean {
	try {
		return new URL(url).hostname.endsWith(".wanditpreview.app");
	} catch {
		// A relative URL has the builder origin, so it is never a preview host.
		return false;
	}
}

/**
 * Starts PostHog and session replay once per page load; later calls do nothing.
 * No key turns analytics off. apps/web/src/main.tsx calls it at boot, before Sentry links to it.
 */
export function initBrowserAnalytics(options: WanditAnalyticsOptions): void {
	if (initialized || !options.key) {
		return;
	}

	posthog.init(options.key, {
		api_host: options.host ?? DEFAULT_POSTHOG_HOST,
		// Bump this with posthog-js when the SDK accepts newer defaults.
		defaults: "2026-01-30",
		person_profiles: "identified_only",
		capture_exceptions: false,
		// Sentry Replay was retired in favor of PostHog; never record typed input.
		session_recording: {
			maskAllInputs: true,
			// Rendered chat/prompt text stays visible in replays — deliberate
			// product decision (Zack watches how users chat).
			// Local false wins over remote config, keeping API payload PII out of replay.
			recordBody: false,
			recordHeaders: false,
			// Network timing is a PostHog project setting. It records the preview iframe URL, and its host label is a bearer secret.
			maskCapturedNetworkRequestFn: (request) =>
				isPreviewUrl(request.name) ? null : request,
		},
		before_send: sanitizeBeforeSend,
	});

	if (options.environment) {
		posthog.register({ environment: options.environment });
	}
	initialized = true;
}

export function analyticsSentryIntegration():
	| ReturnType<typeof posthog.sentryIntegration>
	| undefined {
	// Keep PostHog person/replay links on Sentry events without copying raw
	// exception payloads into PostHog outside our sanitizers.
	return initialized
		? posthog.sentryIntegration({ sendExceptionsToPostHog: false })
		: undefined;
}

export function identifyAnalyticsUser(
	distinctId: string,
	properties?: Record<string, unknown>,
): void {
	if (!initialized) {
		return;
	}
	posthog.identify(distinctId, properties);
}

export function resetAnalytics(): void {
	if (!initialized) {
		return;
	}
	posthog.reset();
}

export function captureEvent(
	event: string,
	properties?: Record<string, unknown>,
): void {
	if (!initialized) {
		return;
	}
	posthog.capture(event, properties);
}

/** Escape hatch for advanced calls; always optional-chain the result. */
export function getAnalytics(): typeof posthog | undefined {
	return initialized ? posthog : undefined;
}
