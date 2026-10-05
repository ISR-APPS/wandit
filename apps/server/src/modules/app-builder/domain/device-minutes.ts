/**
 * Rules of the Appetize device minutes (WANDIT-196): the session limits,
 * the minutes per plan, the Appetize device of each platform, and the
 * minute math. `DeviceSessionsService` and the `device-minutes` runtime
 * read it. Pure constants and math; no I/O.
 */
import type { BillingPlanId, DevicePlatform } from "@wandit/contracts";

/**
 * Longest device session in seconds: 15 minutes, the life of a preview
 * token. The upload script writes it as the Appetize `timeLimit` of both apps.
 */
export const DEVICE_SESSION_TIME_LIMIT_SECONDS = 900;

/** Idle seconds before Appetize ends a session. The upload script writes it as `timeout`. */
export const DEVICE_SESSION_IDLE_TIMEOUT_SECONDS = 120;

/**
 * Two minutes after the time limit, Appetize has ended the session for
 * sure. The user lock expires then, and the minutes task bills a row that
 * the browser never ended.
 */
export const DEVICE_SESSION_GRACE_MS = 2 * 60_000;

/** Life of the one-session-per-user lock: the time limit plus the grace. */
export const DEVICE_SESSION_LOCK_TTL_MS =
	DEVICE_SESSION_TIME_LIMIT_SECONDS * 1000 + DEVICE_SESSION_GRACE_MS;

/**
 * Device minutes per plan in one UTC calendar month. ESTIMATE: Zack checks
 * the numbers before the merge. `starter` is also the plan of a user with
 * no subscription, so a free user gets none.
 */
export const DEVICE_MINUTES_PER_PLAN = Object.freeze({
	starter: 0,
	pro: 60,
	business: 180,
} satisfies Record<BillingPlanId, number>);

/**
 * Appetize price of one minute above the 500 plan minutes: $0.06. ESTIMATE
 * of the cost of one minute; the evidence row records it as the contract rate.
 */
export const APPETIZE_USD_MICROS_PER_MINUTE = 60_000;

/**
 * Appetize device and OS of each platform. The top bar labels the frames
 * "iPhone 15 · iOS 17" and "Pixel 8 · Android 14". The Expo Go 57 simulator
 * build runs only on Appetize iOS 17.2, 18.2, and 26.0.
 */
export const APPETIZE_DEVICES: Readonly<
	Record<DevicePlatform, { device: string; osVersion: string }>
> = Object.freeze({
	ios: { device: "iphone15pro", osVersion: "17.2" },
	android: { device: "pixel8", osVersion: "14.0" },
});

/**
 * Billed minutes of one Appetize session: the started minutes, rounded up.
 * A close before the start (bad vendor data) bills 0.
 */
export function billableMinutes(startTime: Date, closeTime: Date): number {
	const elapsedMs = closeTime.getTime() - startTime.getTime();
	return elapsedMs <= 0 ? 0 : Math.ceil(elapsedMs / 60_000);
}

/** Minutes the payer can still use this month; never below 0. */
export function deviceMinutesLeft(
	plan: BillingPlanId,
	usedMinutes: number,
): number {
	return Math.max(DEVICE_MINUTES_PER_PLAN[plan] - usedMinutes, 0);
}
