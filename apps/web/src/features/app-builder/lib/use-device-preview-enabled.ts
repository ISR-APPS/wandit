/**
 * Rollout gate of the Appetize device preview (WANDIT-196). The app-builder
 * page calls useDevicePreviewEnabled for a mobile project. Appetize bills
 * each device minute, so the PostHog flag `v2-device-preview` starts off
 * for every user. resolveDevicePreviewEnabled is pure, so a spec can call it.
 */
import { getAnalytics } from "@wandit/analytics/browser";
import { useFeatureFlagEnabled } from "@wandit/analytics/react";

/** True when the user may start a device. An unknown flag answers false. */
export function resolveDevicePreviewEnabled(input: {
	/** PostHog flag `v2-device-preview` for the current user; undefined while PostHog loads. */
	flagEnabled: boolean | undefined;
	/** True when the browser has a PostHog client. */
	hasAnalytics: boolean;
}): boolean {
	// Same rule as the Cloud tab: without a PostHog client (no
	// VITE_POSTHOG_KEY, local dev) no flag can load, so the button shows.
	if (!input.hasAnalytics) {
		return true;
	}
	return input.flagEnabled === true;
}

/** True when the phone preview shows the "Run on a device" button. */
export function useDevicePreviewEnabled(): boolean {
	return resolveDevicePreviewEnabled({
		flagEnabled: useFeatureFlagEnabled("v2-device-preview"),
		hasAnalytics: getAnalytics() !== undefined,
	});
}
