/**
 * Resolves whether the V2 app builder is open for the current user.
 * `useV2BuilderEnabled` calls this with the public product setting, the
 * PostHog flag `v2-builder`, and whether a PostHog client exists.
 * Pure function — no React, no network.
 */

/**
 * Mirrors the server `V2BuilderEnabledGuard`. While the setting is unknown,
 * the answer is closed. With a PostHog client, both switches must be on.
 * Without a client (no `VITE_POSTHOG_KEY`), the setting alone decides.
 */
export function resolveV2BuilderEnabled(input: {
	/** `v2BuilderEnabled` from the public settings payload. */
	settingEnabled: boolean | undefined;
	/** PostHog flag `v2-builder` for the current user. */
	flagEnabled: boolean | undefined;
	/** True when the browser has a PostHog client. */
	hasAnalytics: boolean;
}): boolean {
	// The public settings query still loading means the rollout state is
	// unknown; the safe answer is closed.
	if (input.settingEnabled === undefined) {
		return false;
	}
	if (!input.hasAnalytics) {
		return input.settingEnabled;
	}
	return input.settingEnabled && input.flagEnabled === true;
}
