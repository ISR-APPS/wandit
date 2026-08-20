import { describe, expect, it } from "vitest";

import {
	classifyAdsToolApproval,
	isAdsActivationOnlyWrite,
	isAdsApprovalConnector,
} from "./ads-approval-policy";

const meta = (toolName: string, args: unknown) =>
	classifyAdsToolApproval("meta-ads", toolName, args);
const tiktok = (toolName: string, args: unknown) =>
	classifyAdsToolApproval("tiktok-ads", toolName, args);

describe("isAdsApprovalConnector", () => {
	it("covers exactly the two ads connectors", () => {
		expect(isAdsApprovalConnector("meta-ads")).toBe(true);
		expect(isAdsApprovalConnector("tiktok-ads")).toBe(true);
		expect(isAdsApprovalConnector("higgsfield")).toBe(false);
		expect(isAdsApprovalConnector("")).toBe(false);
	});
});

describe("classifyAdsToolApproval", () => {
	it("lets reads through untouched", () => {
		expect(meta("ads_get_ad_entities", {})).toBe("not-applicable");
		expect(tiktok("report_integrated_get", undefined)).toBe("not-applicable");
	});

	it("frees a paused campaign / ad set / ad create (the build path)", () => {
		expect(meta("ads_create_campaign", { status: "PAUSED" })).toBe(
			"not-applicable",
		);
		expect(tiktok("campaign_create", { operation_status: "DISABLE" })).toBe(
			"not-applicable",
		);
		expect(
			tiktok("adgroup_create", {
				budget: 40,
				budget_mode: "BUDGET_MODE_DAY",
				operation_status: "DISABLE",
			}),
		).toBe("not-applicable");
		expect(meta("ads_create_ad", { status: "paused" })).toBe("not-applicable");
	});

	it("only trusts the platform's OWN delivery-status key for the paused exemption", () => {
		// "status: PAUSED" is an unknown field to TikTok — the create would go
		// live on TikTok's ENABLE default, so the card stays.
		expect(tiktok("campaign_create", { budget: 500, status: "PAUSED" })).toBe(
			"user-approval",
		);
		expect(tiktok("ad_create", { status: "paused" })).toBe("user-approval");
		// effective_status is read-only on Meta; a paused value there pauses
		// nothing.
		expect(meta("ads_create_adset", { effective_status: "PAUSED" })).toBe(
			"user-approval",
		);
		expect(meta("ads_create_adset", { operation_status: "DISABLE" })).toBe(
			"user-approval",
		);
	});

	it("keeps the card on a deliverable create without an explicit paused status", () => {
		// Both platforms can default a status-less create to live delivery.
		expect(meta("ads_create_campaign", {})).toBe("user-approval");
		expect(tiktok("campaign_create", undefined)).toBe("user-approval");
		expect(tiktok("smart_plus_campaign_create", { budget: 50 })).toBe(
			"user-approval",
		);
	});

	it("keeps the card on a create that goes live explicitly", () => {
		expect(meta("ads_create_adset", { status: "ACTIVE" })).toBe(
			"user-approval",
		);
		expect(tiktok("adgroup_create", { operation_status: "ENABLE" })).toBe(
			"user-approval",
		);
	});

	it("treats copy / duplicate like creates — a live clone is a launch", () => {
		expect(
			meta("ads_copy_campaign", {
				campaign_id: "120",
				status_option: "INHERITED_FROM_SOURCE",
			}),
		).toBe("user-approval");
		expect(
			meta("ads_copy_campaign", {
				campaign_id: "120",
				status_option: "PAUSED",
			}),
		).toBe("not-applicable");
		expect(meta("ads_duplicate_adset", {})).toBe("user-approval");
	});

	it("applies the paused fail-safe to add-named deliverable creates too", () => {
		expect(meta("ads_add_ad", { adset_id: "1", creative_id: "2" })).toBe(
			"user-approval",
		);
		expect(meta("ads_add_ad", { status: "PAUSED" })).toBe("not-applicable");
		expect(meta("ads_add_users_to_custom_audience", {})).toBe("not-applicable");
	});

	it("frees non-deliverable creates and uploads", () => {
		expect(meta("ads_create_creative", {})).toBe("not-applicable");
		expect(tiktok("file_image_ad_upload", {})).toBe("not-applicable");
		expect(tiktok("upload_video", {})).toBe("not-applicable");
		expect(tiktok("dmp_custom_audience_create", { name: "buyers" })).toBe(
			"not-applicable",
		);
		expect(tiktok("pixel_create", {})).toBe("not-applicable");
	});

	it("cards a money-bearing ancillary create — no activation step gates it", () => {
		expect(
			meta("ads_create_budget_schedule", {
				budget_value: 50000,
				campaign_id: "120",
			}),
		).toBe("user-approval");
	});

	it("cards campaign and ad set activations — the launch moments", () => {
		expect(meta("ads_update_campaign", { status: "ACTIVE" })).toBe(
			"user-approval",
		);
		expect(
			tiktok("campaign_status_update", {
				campaign_ids: ["1"],
				operation_status: "ENABLE",
			}),
		).toBe("user-approval");
		expect(meta("ads_activate_adset", {})).toBe("user-approval");
		expect(meta("boost_post", {})).toBe("user-approval");
		// "ad set" split across tokens must never read as ad-level.
		expect(meta("ads_update_ad_set", { status: "ACTIVE" })).toBe(
			"user-approval",
		);
	});

	it("frees single-AD activations — the money was approved on the parents' cards", () => {
		expect(meta("ads_update_ad", { id: "1", status: "ACTIVE" })).toBe(
			"not-applicable",
		);
		expect(
			tiktok("ad_status_update", {
				ad_ids: ["9"],
				operation_status: "ENABLE",
			}),
		).toBe("not-applicable");
	});

	it("catches a status-setter whose name reads like a read", () => {
		expect(
			tiktok("campaign_status", {
				campaign_ids: ["c1"],
				operation_status: "ENABLE",
			}),
		).toBe("user-approval");
	});

	it("frees pausing and disabling — the protective direction", () => {
		expect(meta("ads_update_campaign", { status: "PAUSED" })).toBe(
			"not-applicable",
		);
		expect(
			tiktok("adgroup_status_update", {
				adgroup_ids: ["9"],
				operation_status: "DISABLE",
			}),
		).toBe("not-applicable");
	});

	it("cards money changes outside a create", () => {
		expect(meta("ads_update_adset", { daily_budget: "5000" })).toBe(
			"user-approval",
		);
		expect(
			tiktok("adgroup_budget_update", {
				budgets: [{ adgroup_id: "9", budget: 80 }],
			}),
		).toBe("user-approval");
		expect(meta("ads_update_adset", { bid_amount: 200 })).toBe("user-approval");
	});

	it("frees money-free edits on existing entities", () => {
		expect(meta("ads_update_campaign", { name: "Summer v2" })).toBe(
			"not-applicable",
		);
		expect(
			tiktok("adgroup_update", { adgroup_id: "9", location_ids: ["12"] }),
		).toBe("not-applicable");
	});

	it("cards deletes and archives, by verb or by status value", () => {
		expect(meta("ads_delete_campaign", { id: "1" })).toBe("user-approval");
		expect(
			tiktok("campaign_status_update", {
				campaign_ids: ["1"],
				operation_status: "DELETE",
			}),
		).toBe("user-approval");
		expect(meta("ads_update_campaign", { status: "ARCHIVED" })).toBe(
			"user-approval",
		);
		expect(meta("ads_archive_campaign", { id: "1" })).toBe("user-approval");
		// Destruction beats the ad-level activation exemption.
		expect(
			tiktok("ad_status_update", {
				ad_ids: ["9"],
				operation_status: "DELETE",
			}),
		).toBe("user-approval");
	});

	it("reads nested statuses and budgets (bulk and wrapped shapes)", () => {
		expect(
			meta("batch_update", {
				updates: [{ campaign_id: "1", status: "ACTIVE" }],
			}),
		).toBe("user-approval");
		expect(
			tiktok("ad_create", {
				creatives: [{ ad_name: "a" }],
				operation_status: "DISABLE",
			}),
		).toBe("not-applicable");
	});

	it("defaults an unknown status-less write to no card only when it cannot spend", () => {
		// Unknown verb, no money keys, no status: the write cannot start
		// delivery by itself, so it stays free (the 72 h guard still runs).
		expect(meta("ads_frobnicate_widget", {})).toBe("not-applicable");
	});
});

describe("isAdsActivationOnlyWrite", () => {
	it("recognises pure activations by status value or name verb", () => {
		expect(
			isAdsActivationOnlyWrite("campaign_status_update", {
				campaign_ids: ["1"],
				operation_status: "ENABLE",
			}),
		).toBe(true);
		expect(
			isAdsActivationOnlyWrite("ads_update_campaign", { status: "ACTIVE" }),
		).toBe(true);
		expect(isAdsActivationOnlyWrite("ads_activate_adset", { id: "1" })).toBe(
			true,
		);
	});

	it("refuses when money, destruction, or a non-activating status rides along", () => {
		expect(
			isAdsActivationOnlyWrite("ads_update_campaign", {
				daily_budget: "9000",
				status: "ACTIVE",
			}),
		).toBe(false);
		expect(
			isAdsActivationOnlyWrite("campaign_status_update", {
				operation_status: "DELETE",
			}),
		).toBe(false);
		expect(
			isAdsActivationOnlyWrite("adgroup_status_update", {
				operation_status: "DISABLE",
			}),
		).toBe(false);
		expect(
			isAdsActivationOnlyWrite("ads_update_adset", { targeting: {} }),
		).toBe(false);
	});
});
