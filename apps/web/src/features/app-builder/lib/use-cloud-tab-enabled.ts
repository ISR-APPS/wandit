/**
 * Rollout gate of the Cloud panels (WANDIT-188). The app-builder page calls
 * useCloudTabEnabled to show or hide the Backend group of the More view and
 * to let `?panel=` open a Cloud panel. It combines the project engine, the
 * product setting `v2BuilderEnabled`, and the PostHog flag `v2-cloud-tab`
 * through resolveCloudTabEnabled, which is pure so a spec can call it.
 */
import { getAnalytics } from "@wandit/analytics/browser";
import { useFeatureFlagEnabled } from "@wandit/analytics/react";
import type { ProjectEngine } from "@wandit/contracts";

import { usePublicSettingsQuery } from "@/features/settings";

/**
 * True when all three checks pass: a `v2_app` project, the V2 builder
 * rollout, and the `v2-cloud-tab` flag. An unknown flag answers false, like
 * resolveV2BuilderEnabled, so the Backend group never shows and then goes away.
 */
export function resolveCloudTabEnabled(input: {
	/** Engine of the open project; undefined when the project does not exist. Only a `v2_app` project has a Supabase backend. */
	engine: ProjectEngine | undefined;
	/** True when this build has V2 and the product setting `v2BuilderEnabled` is on. */
	v2BuilderEnabled: boolean;
	/** PostHog flag `v2-cloud-tab` for the current user; undefined while PostHog loads. */
	flagEnabled: boolean | undefined;
	/** True when the browser has a PostHog client. */
	hasAnalytics: boolean;
}): boolean {
	if (input.engine !== "v2_app" || !input.v2BuilderEnabled) {
		return false;
	}
	// Same rule as resolveV2BuilderEnabled: without a PostHog client (no
	// VITE_POSTHOG_KEY) no flag can load, so the other checks decide.
	if (!input.hasAnalytics) {
		return true;
	}
	return input.flagEnabled === true;
}

/** True when the More view shows the Backend group for this project. False while the rollout state loads. */
export function useCloudTabEnabled(engine: ProjectEngine | undefined): boolean {
	const { data: publicSettings } = usePublicSettingsQuery();
	const flagEnabled = useFeatureFlagEnabled("v2-cloud-tab");

	return resolveCloudTabEnabled({
		engine,
		// The page shows a project that the API opened for this user. The API then skips the
		// per-user `v2-builder` flag (workspaces-sharing.md 3.3), so an invitee without it still edits.
		v2BuilderEnabled:
			__V2_BUILDER_IN_BUILD__ && publicSettings?.v2BuilderEnabled === true,
		flagEnabled,
		hasAnalytics: getAnalytics() !== undefined,
	});
}
