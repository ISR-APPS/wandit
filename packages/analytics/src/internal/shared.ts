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

export function stripUrlQuery(value: string): string {
	try {
		const isRelative = value.startsWith("/");
		const url = isRelative
			? new URL(value, "https://analytics-sanitizer.invalid")
			: new URL(value);
		return isRelative ? url.pathname : url.origin + url.pathname;
	} catch {
		return value;
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
