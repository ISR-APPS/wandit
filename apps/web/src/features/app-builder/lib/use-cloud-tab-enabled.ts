/**
 * Rollout gate of the Cloud tab (WANDIT-188). The app-builder page calls
 * useCloudTabEnabled to show or hide the Cloud view. It combines the project
 * engine, useV2BuilderEnabled, and the PostHog flag `v2-cloud-tab` through
 * resolveCloudTabEnabled, which is pure so a spec can call it.
 */
import { getAnalytics } from "@wandit/analytics/browser";
import { useFeatureFlagEnabled } from "@wandit/analytics/react";
import type { ProjectEngine } from "@wandit/contracts";

import { useV2BuilderEnabled } from "./use-v2-builder-enabled";

/**
 * True when all three checks pass: a `v2_app` project, the V2 builder
 * rollout, and the `v2-cloud-tab` flag. An unknown flag answers false, like
 * resolveV2BuilderEnabled, so the tab never shows and then goes away.
 */
export function resolveCloudTabEnabled(input: {
	/** Engine of the open project; undefined when the project does not exist. Only a `v2_app` project has a Supabase backend. */
	engine: ProjectEngine | undefined;
	/** Answer of useV2BuilderEnabled. */
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

/** True when the page shows the Cloud view for this project. False while the rollout state loads. */
export function useCloudTabEnabled(engine: ProjectEngine | undefined): boolean {
	const v2BuilderEnabled = useV2BuilderEnabled();
	const flagEnabled = useFeatureFlagEnabled("v2-cloud-tab");

	return resolveCloudTabEnabled({
		engine,
		v2BuilderEnabled,
		flagEnabled,
		hasAnalytics: getAnalytics() !== undefined,
	});
}
