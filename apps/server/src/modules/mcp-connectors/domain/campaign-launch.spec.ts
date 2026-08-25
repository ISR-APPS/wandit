import { describe, expect, it } from "vitest";

import { isCampaignLaunch } from "./campaign-launch";

describe("isCampaignLaunch", () => {
	it.each([
		["meta-ads", "ads_update_campaign", { status: "ACTIVE" }],
		["tiktok-ads", "campaign_status_update", { operation_status: "ENABLE" }],
		["meta-ads", "ads_activate_adset", { id: "adset-1" }],
		[
			"tiktok-ads",
			"ad_status_update",
			{ ad_ids: ["ad-1"], operation_status: "enable" },
		],
		["tiktok-ads", "campaign_status", { operation_status: "ENABLE" }],
	] as const)("recognises %s %s as an activation", (connectorSlug, toolName, args) => {
		expect(isCampaignLaunch(connectorSlug, toolName, args)).toBe(true);
	});

	it.each([
		["meta-ads", "ads_create_adset", { status: "ACTIVE" }],
		[
			"tiktok-ads",
			"adgroup_create",
			{ budget: 40, operation_status: "ENABLE" },
		],
		["tiktok-ads", "ad_create", { opt_status: "enabled" }],
	] as const)("recognises an explicitly active create for %s %s", (connectorSlug, toolName, args) => {
		expect(isCampaignLaunch(connectorSlug, toolName, args)).toBe(true);
	});

	it.each([
		["meta-ads", "ads_create_campaign", {}],
		["tiktok-ads", "ad_create", { creative_id: "creative-1" }],
		[
			"meta-ads",
			"ads_duplicate_campaign",
			{ status_option: "INHERITED_FROM_SOURCE" },
		],
		["meta-ads", "ads_create_campaign", { status: "PAUSED" }],
		[
			"tiktok-ads",
			"adgroup_create",
			{ budget: 40, operation_status: "DISABLE" },
		],
		["meta-ads", "ads_copy_adset", { status_option: "paused" }],
		["meta-ads", "ads_clone_campaign", { status: "PENDING_REVIEW" }],
	] as const)("rejects a create without an explicit activating status for %s %s", (connectorSlug, toolName, args) => {
		expect(isCampaignLaunch(connectorSlug, toolName, args)).toBe(false);
	});

	it("trusts only the connector's writable delivery-status fields for creates", () => {
		expect(
			isCampaignLaunch("tiktok-ads", "campaign_create", {
				status: "ACTIVE",
			}),
		).toBe(false);
		expect(
			isCampaignLaunch("meta-ads", "ads_create_campaign", {
				effective_status: "ACTIVE",
			}),
		).toBe(false);
	});

	it.each([
		["meta-ads", "ads_delete_campaign", { id: "campaign-1" }],
		["tiktok-ads", "campaign_status_update", { operation_status: "DELETE" }],
		["meta-ads", "ads_update_adset", { daily_budget: 5000 }],
		["tiktok-ads", "adgroup_bid_update", { bid: 20 }],
		["meta-ads", "ads_upload_image", { file: "image" }],
		["meta-ads", "ads_create_creative", {}],
		["meta-ads", "ads_update_campaign", { status: "PAUSED" }],
		["tiktok-ads", "adgroup_status_update", { operation_status: "DISABLE" }],
		["meta-ads", "campaign_get", { status: "ACTIVE" }],
		["meta-ads", "campaign_status_get", { status: "ACTIVE" }],
	] as const)("rejects non-launch operation %s %s", (connectorSlug, toolName, args) => {
		expect(isCampaignLaunch(connectorSlug, toolName, args)).toBe(false);
	});

	it("walks wrapped and bulk status arguments", () => {
		expect(
			isCampaignLaunch("tiktok-ads", "adgroup_status_update", {
				params: {
					updates: [{ adgroup_id: "1", operation_status: "ENABLE" }],
				},
			}),
		).toBe(true);
	});

	it("ignores non-ads connectors and malformed names", () => {
		expect(isCampaignLaunch("higgsfield", "campaign_create", {})).toBe(false);
		expect(isCampaignLaunch("meta-ads", "", { status: "ACTIVE" })).toBe(false);
	});
});
