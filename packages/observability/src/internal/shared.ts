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
 * Prefixes of live keys (docs/v2/research/security.md 6.3): Stripe secret
 * and restricted keys, Supabase secret keys, the service-role key, and
 * Stripe webhook secrets. A string that holds one is replaced whole.
 */
const SECRET_STRING_PATTERN =
	/sk_live_|rk_live_|sb_secret_|service_role|whsec_/;

/** Replacement text; the same marker Sentry's own filters use. */
const FILTERED = "[Filtered]";

/**
 * Matches a `"value": "..."` field in a JSON body string, escapes included.
 * The V2 secrets routes send `{ value }`; the value must never reach Sentry.
 */
const JSON_VALUE_FIELD_PATTERN = /"value"\s*:\s*"(?:[^"\\]|\\.)*"/g;

/**
 * Structural subset of Sentry's event shape — keeps this file free of SDK
 * imports so each entry point only pulls in its own runtime's SDK.
 */
interface ScrubbableEvent {
	exception?: {
		values?: Array<{
			mechanism?: {
				type?: string;
			};
		}>;
	};
	request?: {
		cookies?: unknown;
		headers?: Record<string, string>;
		/** The captured body, `unknown` as in the SDK: a JSON string in Node, or the parsed object. */
		data?: unknown;
	};
}

interface ScrubbableEventHint {
	originalException?: unknown;
}

const WANDIT_CAPTURED = Symbol.for("wandit.ai-error.captured");

const wasCapturedByWandit = (error: unknown): boolean =>
	typeof error === "object" &&
	error !== null &&
	(error as Record<PropertyKey, unknown>)[WANDIT_CAPTURED] === true;

/**
 * `beforeSend` used by every runtime: strips session credentials, the
 * `value` body field of the secrets routes, and every string that looks
 * like a live key; drops duplicate Vercel AI events after the same error
 * was captured explicitly.
 */
export const scrubEvent = <E extends ScrubbableEvent>(
	event: E,
	hint?: ScrubbableEventHint,
): E | null => {
	if (
		event.exception?.values?.some(
			(value) => value.mechanism?.type === "auto.vercelai.channel",
		) &&
		wasCapturedByWandit(hint?.originalException)
	) {
		return null;
	}

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
		event.request.data = dropValueField(event.request.data);
	}
	scrubSecretStrings(event, new WeakSet());
	return event;
};

/**
 * Masks the `value` field of a request body. The SDK types the body as
 * `unknown`; the two guards cover the JSON string and the parsed object.
 */
const dropValueField = (body: unknown): unknown => {
	if (typeof body === "string") {
		return body.replace(JSON_VALUE_FIELD_PATTERN, `"value":"${FILTERED}"`);
	}
	if (typeof body === "object" && body !== null && "value" in body) {
		body.value = FILTERED;
	}
	return body;
};

/**
 * Walks the event in place and replaces every string that holds a live-key
 * prefix. The event is SDK data of no fixed shape, so each node is
 * narrowed with type guards. `seen` stops the walk on a cycle.
 */
const scrubSecretStrings = (node: unknown, seen: WeakSet<object>): void => {
	if (typeof node !== "object" || node === null || seen.has(node)) {
		return;
	}
	seen.add(node);
	for (const key of Object.keys(node)) {
		const child: unknown = Reflect.get(node, key);
		if (typeof child === "string") {
			if (SECRET_STRING_PATTERN.test(child)) {
				Reflect.set(node, key, FILTERED);
			}
		} else {
			scrubSecretStrings(child, seen);
		}
	}
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
