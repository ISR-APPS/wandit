/**
 * React hook for the V2 app-builder rollout switch.
 * No caller yet; WANDIT-175 wires it into the V2 composer. It combines the
 * public product setting, the PostHog flag `v2-builder`, and the client
 * presence through `resolveV2BuilderEnabled`.
 */
import { getAnalytics } from "@wandit/analytics/browser";
import { useFeatureFlagEnabled } from "@wandit/analytics/react";

import { usePublicSettingsQuery } from "@/features/settings";
import { resolveV2BuilderEnabled } from "./v2-builder-flag";

/**
 * True when the V2 app builder is open for the current user. False while
 * the public settings are still loading.
 */
export function useV2BuilderEnabled(): boolean {
	const flagEnabled = useFeatureFlagEnabled("v2-builder");
	const { data: publicSettings } = usePublicSettingsQuery();

	return resolveV2BuilderEnabled({
		flagEnabled,
		hasAnalytics: getAnalytics() !== undefined,
		settingEnabled: publicSettings?.v2BuilderEnabled,
	});
}
