import { describe, expect, it } from "vitest";

import {
	CREDIT_EVENT_THRESHOLD_PERCENTAGES,
	creditEventThresholdsForGrant,
	DONE_EVENT_MAPPING,
	EVENT_COOLDOWN_MS,
	EVENT_HOLD_MS,
	FREE_ONLY_EVENTS,
	LIFECYCLE_EVENT_DROP_REASONS,
	LIFECYCLE_EVENT_NAMES,
	ONCE_PER_USER_EVENTS,
} from "./lifecycle-event";

describe("lifecycle event rules", () => {
	it("defines the exact event contract and once-per-user set", () => {
		expect(LIFECYCLE_EVENT_NAMES).toEqual([
			"signup_completed",
			"first_prompt_sent",
			"website_generated",
			"landing_page_generated",
			"image_generated",
			"video_generated",
			"marketing_strategy_generated",
			"ads_connected",
			"ads_analysis_completed",
			"campaign_launched",
			"credits_25_used",
			"credits_40_used",
			"pricing_viewed",
			"upgrade_clicked",
			"payment_completed",
		]);
		expect([...ONCE_PER_USER_EVENTS]).toHaveLength(13);
		expect(ONCE_PER_USER_EVENTS.has("pricing_viewed")).toBe(false);
		expect(ONCE_PER_USER_EVENTS.has("upgrade_clicked")).toBe(false);
	});

	it("defines holds, cooldowns, free-only events, done flags, and drop reasons", () => {
		expect(EVENT_HOLD_MS).toEqual({
			credits_40_used: 900_000,
			pricing_viewed: 900_000,
			signup_completed: 600_000,
			upgrade_clicked: 900_000,
		});
		expect(EVENT_COOLDOWN_MS).toEqual({
			pricing_viewed: 604_800_000,
			upgrade_clicked: 259_200_000,
		});
		expect([...FREE_ONLY_EVENTS]).toEqual([
			"credits_25_used",
			"credits_40_used",
			"pricing_viewed",
			"upgrade_clicked",
		]);
		expect(CREDIT_EVENT_THRESHOLD_PERCENTAGES).toEqual({
			credits_25_used: 0.5,
			credits_40_used: 0.8,
		});
		expect(creditEventThresholdsForGrant(700)).toEqual({
			credits_25_used: 350,
			credits_40_used: 560,
		});
		expect(creditEventThresholdsForGrant(5000)).toEqual({
			credits_25_used: 2500,
			credits_40_used: 4000,
		});
		expect(DONE_EVENT_MAPPING.website_generated).toEqual({
			doneEvent: "landing_page_generated",
			payloadKey: "done_landing_page",
		});
		expect(LIFECYCLE_EVENT_DROP_REASONS).toEqual([
			"disabled",
			"not_free",
			"paid_meanwhile",
			"no_email",
		]);
	});
});
