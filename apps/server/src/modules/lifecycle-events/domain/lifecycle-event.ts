import { lifecycleEventName } from "@wandit/db/schema/lifecycle-events";

export type LifecycleEventName = Exclude<
	(typeof lifecycleEventName.enumValues)[number],
	"video_generated"
>;

export const LIFECYCLE_EVENT_NAMES = lifecycleEventName.enumValues.filter(
	(event): event is LifecycleEventName => event !== "video_generated",
);

// The DB enum keeps retired values (e.g. video_generated) for historical rows;
// this guard separates them from events the dispatcher may still act on.
export function isActiveLifecycleEvent(
	event: (typeof lifecycleEventName.enumValues)[number],
): event is LifecycleEventName {
	return event !== "video_generated";
}

export type LifecycleCapturePayload = {
	connector?: "meta-ads" | "tiktok-ads";
	interval?: "month" | "year" | "topup";
	method?: "card" | "offline";
	surface?: string;
};

export type EnqueueLifecycleEvent = {
	dispatchAfter?: Date;
	event: LifecycleEventName;
	idempotencyKey: string;
	payload?: LifecycleCapturePayload;
	userId: string;
};

export const ONCE_PER_USER_EVENTS = new Set<LifecycleEventName>([
	"signup_completed",
	"first_prompt_sent",
	"website_generated",
	"landing_page_generated",
	"image_generated",
	"marketing_strategy_generated",
	"ads_connected",
	"ads_analysis_completed",
	"campaign_launched",
	"credits_25_used",
	"credits_40_used",
	"payment_completed",
]);

export const EVENT_HOLD_MS = {
	credits_40_used: 15 * 60 * 1000,
	pricing_viewed: 15 * 60 * 1000,
	signup_completed: 10 * 60 * 1000,
	upgrade_clicked: 15 * 60 * 1000,
} as const satisfies Partial<Record<LifecycleEventName, number>>;

export const EVENT_COOLDOWN_MS = {
	pricing_viewed: 7 * 24 * 60 * 60 * 1000,
	upgrade_clicked: 3 * 24 * 60 * 60 * 1000,
} as const satisfies Partial<Record<LifecycleEventName, number>>;

export const FREE_ONLY_EVENTS = new Set<LifecycleEventName>([
	"credits_25_used",
	"credits_40_used",
	"pricing_viewed",
	"upgrade_clicked",
]);

// Event names remain historical; thresholds follow 50 % / 80 % of the
// centi-credit grant actually snapshotted for each user.
export const CREDIT_EVENT_THRESHOLD_PERCENTAGES = {
	credits_25_used: 0.5,
	credits_40_used: 0.8,
} as const satisfies Partial<Record<LifecycleEventName, number>>;

export function creditEventThresholdsForGrant(
	grantCentiCredits: number,
): Record<"credits_25_used" | "credits_40_used", number> {
	return {
		credits_25_used: Math.ceil(
			grantCentiCredits * CREDIT_EVENT_THRESHOLD_PERCENTAGES.credits_25_used,
		),
		credits_40_used: Math.ceil(
			grantCentiCredits * CREDIT_EVENT_THRESHOLD_PERCENTAGES.credits_40_used,
		),
	};
}

export const DONE_EVENT_MAPPING = {
	ads_analysis_completed: {
		doneEvent: "campaign_launched",
		payloadKey: "done_campaign",
	},
	ads_connected: {
		doneEvent: "ads_analysis_completed",
		payloadKey: "done_analysis",
	},
	image_generated: {
		doneEvent: "marketing_strategy_generated",
		payloadKey: "done_strategy",
	},
	landing_page_generated: {
		doneEvent: "image_generated",
		payloadKey: "done_image",
	},
	marketing_strategy_generated: {
		doneEvent: "ads_connected",
		payloadKey: "done_ads_connected",
	},
	website_generated: {
		doneEvent: "landing_page_generated",
		payloadKey: "done_landing_page",
	},
} as const satisfies Partial<
	Record<
		LifecycleEventName,
		{ doneEvent: LifecycleEventName; payloadKey: `done_${string}` }
	>
>;

export const LIFECYCLE_EVENT_DROP_REASONS = [
	"disabled",
	"not_free",
	"paid_meanwhile",
	"no_email",
	"retired",
] as const;

export type LifecycleEventDropReason =
	(typeof LIFECYCLE_EVENT_DROP_REASONS)[number];

export function isOncePerUserEvent(event: LifecycleEventName): boolean {
	return ONCE_PER_USER_EVENTS.has(event);
}

export function lifecycleEventIdempotencyKey(
	event: LifecycleEventName,
	userId: string,
): string {
	return `${event}:${userId}`;
}

export function lifecycleEventHoldMs(event: LifecycleEventName): number {
	return (
		(EVENT_HOLD_MS as Partial<Record<LifecycleEventName, number>>)[event] ?? 0
	);
}

export function lifecycleEventCooldownMs(event: LifecycleEventName): number {
	return (
		(EVENT_COOLDOWN_MS as Partial<Record<LifecycleEventName, number>>)[event] ??
		0
	);
}
