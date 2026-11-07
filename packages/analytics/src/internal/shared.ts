/**
 * Shared PostHog options and URL sanitizers of the browser and node clients.
 * ../browser.ts and ../node.ts call them before an event or a replay URL leaves the app.
 */
// EU cloud to match our Sentry region (data stays in the EU).
export const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

export type WanditAnalyticsOptions = {
	/** PostHog project API key (phc_...). Unset = analytics fully disabled. */
	key?: string;
	/** PostHog API host. Defaults to the EU cloud. */
	host?: string;
	/** production | preview | development — attached to every event. */
	environment?: string;
};

// Matches the invite link token in the web page `/join/<token>` and in the API route
// `/invite-links/<token>`. Whoever holds the token joins a workspace or gets a project grant.
const INVITE_LINK_TOKEN_PATTERN = /\/(join|invite-links)\/[^/?#]+/g;

/**
 * Replaces an invite link token in a URL or a path with `:token`.
 * stripUrlQuery and the session replay URL mask of ../browser.ts call it.
 */
export function redactInviteLinkToken(value: string): string {
	return value.replace(INVITE_LINK_TOKEN_PATTERN, "/$1/:token");
}

/** Removes the query string, the hash, and an invite link token from an analytics URL. */
export function stripUrlQuery(value: string): string {
	try {
		const isRelative = value.startsWith("/");
		const url = isRelative
			? new URL(value, "https://analytics-sanitizer.invalid")
			: new URL(value);
		return redactInviteLinkToken(
			isRelative ? url.pathname : url.origin + url.pathname,
		);
	} catch {
		// Not a URL: the token can still be in the text.
		return redactInviteLinkToken(value);
	}
}

export function sanitizeUrlProperties(
	properties: Record<string, unknown>,
): Record<string, unknown> {
	for (const [key, value] of Object.entries(properties)) {
		const normalizedKey = key.toLowerCase();
		if (
			(normalizedKey.includes("url") ||
				normalizedKey.includes("referrer") ||
				normalizedKey.includes("href") ||
				normalizedKey.includes("path") ||
				normalizedKey.includes("link")) &&
			typeof value === "string" &&
			(value.startsWith("http") || value.startsWith("/"))
		) {
			properties[key] = stripUrlQuery(value);
		}
	}

	return properties;
}
