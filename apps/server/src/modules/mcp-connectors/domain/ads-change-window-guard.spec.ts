import { describe, expect, it } from "vitest";

import { evaluateAdsChangeWindow } from "./ads-change-window-guard";

const NOW = new Date("2026-08-19T12:00:00.000Z");

function hoursAgo(hours: number): Date {
	return new Date(NOW.getTime() - hours * 3_600_000);
}

function evaluate(
	overrides: Partial<Parameters<typeof evaluateAdsChangeWindow>[0]> = {},
) {
	return evaluateAdsChangeWindow({
		acknowledged: false,
		args: { adset_id: "adset-1", targeting: {} },
		connectorSlug: "meta-ads",
		lastWriteAt: hoursAgo(10),
		now: NOW,
		targetEntityIds: ["adset-1"],
		toolName: "update_adset",
		...overrides,
	});
}

describe("evaluateAdsChangeWindow", () => {
	it("blocks a write on an entity changed less than 72 hours ago", () => {
		const verdict = evaluate();

		expect(verdict.blocked).toBe(true);
		if (!verdict.blocked) {
			return;
		}

		expect(verdict.hoursSince).toBeCloseTo(10);
		expect(verdict.hoursRemaining).toBeCloseTo(62);
		expect(verdict.message).toContain("this ad set was created or changed");
		expect(verdict.message).toContain("10 hours ago");
		expect(verdict.message).toContain("62 h from now");
		expect(verdict.message).toContain("Do NOT retry on your own");
		expect(verdict.message).toContain("Their insistence IS the approval");
		expect(verdict.message).toContain("their final say");
	});

	it("blocks a bulk write when any of its entities is inside the window", () => {
		const verdict = evaluate({
			connectorSlug: "tiktok-ads",
			lastWriteAt: hoursAgo(5),
			targetEntityIds: ["777", "778"],
			toolName: "adgroup/status/update/",
		});

		expect(verdict.blocked).toBe(true);
		if (verdict.blocked) {
			expect(verdict.message).toContain(
				"at least one of these ad sets (777, 778) was created or changed",
			);
			expect(verdict.message).toContain("67 h from now");
		}
	});

	it("names the level from the tool and never shows 0 hours", () => {
		const campaign = evaluate({
			lastWriteAt: hoursAgo(0.2),
			toolName: "campaign_update",
		});
		expect(campaign).toMatchObject({ blocked: true });
		if (campaign.blocked) {
			expect(campaign.message).toContain("this campaign was");
			expect(campaign.message).toContain("less than 1 hours ago");
		}

		const tiktokAd = evaluate({
			connectorSlug: "tiktok-ads",
			toolName: "ad/status/update/",
		});
		expect(tiktokAd).toMatchObject({ blocked: true });
		if (tiktokAd.blocked) {
			expect(tiktokAd.message).toContain("this ad was");
		}
	});

	it("passes once the window has elapsed", () => {
		expect(evaluate({ lastWriteAt: hoursAgo(72) })).toEqual({ blocked: false });
		expect(evaluate({ lastWriteAt: hoursAgo(200) })).toEqual({
			blocked: false,
		});
	});

	it("passes when the user acknowledged the rule", () => {
		expect(evaluate({ acknowledged: true })).toEqual({ blocked: false });
	});

	it("passes when Wandit never wrote to the entity or no entity is known", () => {
		expect(evaluate({ lastWriteAt: null })).toEqual({ blocked: false });
		expect(evaluate({ targetEntityIds: [] })).toEqual({ blocked: false });
	});

	it("never blocks a pure activation — launching what was built paused", () => {
		expect(
			evaluate({
				args: { campaign_ids: ["c1"], operation_status: "ENABLE" },
				connectorSlug: "tiktok-ads",
				lastWriteAt: hoursAgo(0.1),
				targetEntityIds: ["c1"],
				toolName: "campaign/status/update/",
			}),
		).toEqual({ blocked: false });
		expect(
			evaluate({
				args: { id: "adset-1", status: "ACTIVE" },
				lastWriteAt: hoursAgo(1),
				toolName: "update_adset",
			}),
		).toEqual({ blocked: false });
	});

	it("still blocks an activation that also touches money or pauses", () => {
		expect(
			evaluate({
				args: { daily_budget: "9000", id: "adset-1", status: "ACTIVE" },
				lastWriteAt: hoursAgo(1),
				toolName: "update_adset",
			}),
		).toMatchObject({ blocked: true });
		expect(
			evaluate({
				args: { adgroup_ids: ["777"], operation_status: "DISABLE" },
				connectorSlug: "tiktok-ads",
				lastWriteAt: hoursAgo(1),
				targetEntityIds: ["777"],
				toolName: "adgroup/status/update/",
			}),
		).toMatchObject({ blocked: true });
	});

	it("never blocks reads or creates", () => {
		expect(evaluate({ toolName: "get_adset" })).toEqual({ blocked: false });
		expect(evaluate({ toolName: "adset_insights" })).toEqual({
			blocked: false,
		});
		expect(evaluate({ toolName: "create_adset" })).toEqual({ blocked: false });
		expect(evaluate({ toolName: "ad/create/" })).toEqual({ blocked: false });
		expect(evaluate({ toolName: "upload_ad_image" })).toEqual({
			blocked: false,
		});
		expect(evaluate({ toolName: "add_ad_to_adset" })).toEqual({
			blocked: false,
		});
		expect(evaluate({ toolName: "publish_ad" })).toEqual({ blocked: false });
		expect(evaluate({ toolName: "ads_create_ad" })).toEqual({ blocked: false });
	});

	it("matches create verbs as tokens, not substrings", () => {
		expect(
			evaluate({ toolName: "ads_update_ad_additional_fields" }),
		).toMatchObject({ blocked: true });
		expect(evaluate({ toolName: "update_address" })).toMatchObject({
			blocked: true,
		});
	});

	it("ignores non-ads connectors", () => {
		expect(evaluate({ connectorSlug: "higgsfield" })).toEqual({
			blocked: false,
		});
	});

	it("treats a future lastWriteAt as just written", () => {
		const verdict = evaluate({ lastWriteAt: new Date(NOW.getTime() + 60_000) });
		expect(verdict.blocked).toBe(true);
		if (verdict.blocked) {
			expect(verdict.hoursSince).toBe(0);
			expect(verdict.hoursRemaining).toBe(72);
		}
	});
});
