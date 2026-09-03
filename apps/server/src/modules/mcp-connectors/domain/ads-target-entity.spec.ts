import { describe, expect, it } from "vitest";

import {
	adsPlatformError,
	extractAdsCreatedEntityIds,
	extractAdsTargetEntities,
	extractAdsTargetEntityId,
	extractAdsTargetEntityIds,
	isAdsCreateToolName,
	levelFromToolName,
} from "./ads-target-entity";

function textResult(payload: unknown) {
	return { content: [{ text: JSON.stringify(payload), type: "text" }] };
}

describe("extractAdsTargetEntityIds", () => {
	it("ignores non-ads connectors", () => {
		expect(
			extractAdsTargetEntityIds("higgsfield", "update_campaign", {
				campaign_id: "123",
			}),
		).toEqual([]);
		expect(
			extractAdsTargetEntityId("higgsfield", "update_campaign", {
				campaign_id: "123",
			}),
		).toBeNull();
	});

	it("reads explicit campaign / adset / ad ids", () => {
		expect(
			extractAdsTargetEntityIds("meta-ads", "ads_update_campaign", {
				campaign_id: "111",
			}),
		).toEqual(["111"]);
		expect(
			extractAdsTargetEntityIds("meta-ads", "ads_update_adset", {
				adset_id: 222,
			}),
		).toEqual(["222"]);
		expect(
			extractAdsTargetEntityIds("tiktok-ads", "adgroup/update/", {
				adgroup_id: "333",
			}),
		).toEqual(["333"]);
		expect(
			extractAdsTargetEntityIds("tiktok-ads", "ad/status/update/", {
				ad_group_id: "444",
			}),
		).toEqual(["444"]);
		expect(
			extractAdsTargetEntityIds("meta-ads", "update_ad", { ad_id: "555" }),
		).toEqual(["555"]);
		expect(
			extractAdsTargetEntityIds("meta-ads", "update_ad", {
				creative_id: "666",
			}),
		).toEqual(["666"]);
		expect(
			extractAdsTargetEntityId("meta-ads", "update_ad", { ad_id: "555" }),
		).toBe("555");
	});

	it("returns every id of the most specific level and drops parent ids", () => {
		expect(
			extractAdsTargetEntities("meta-ads", "update_ad", {
				ad_id: "ad-1",
				adset_id: "adset-1",
				campaign_id: "campaign-1",
			}),
		).toEqual({ ids: ["ad-1"], level: "ad" });
		expect(
			extractAdsTargetEntities("meta-ads", "update_adset", {
				adset_id: "adset-1",
				campaign_id: "campaign-1",
			}),
		).toEqual({ ids: ["adset-1"], level: "adset" });
		expect(
			extractAdsTargetEntities("tiktok-ads", "adgroup/status/update/", {
				adgroup_ids: ["777", "778"],
				campaign_id: "c-1",
			}),
		).toEqual({ ids: ["777", "778"], level: "adset" });
	});

	it("reads TikTok plural id arrays, numbers included, without duplicates", () => {
		expect(
			extractAdsTargetEntityIds("tiktok-ads", "adgroup/status/update/", {
				adgroup_ids: ["777", "778", 779, "777"],
				operation_status: "DISABLE",
			}),
		).toEqual(["777", "778", "779"]);
		expect(
			extractAdsTargetEntityIds("tiktok-ads", "campaign/status/update/", {
				campaign_ids: [1, 2],
			}),
		).toEqual(["1", "2"]);
		expect(
			extractAdsTargetEntityIds("tiktok-ads", "ad/status/update/", {
				ad_ids: ["a-1"],
				ad_group_ids: ["g-1"],
			}),
		).toEqual(["a-1"]);
		expect(
			extractAdsTargetEntityIds("meta-ads", "ads_update_adsets", {
				adset_ids: ["s-1", "s-2"],
			}),
		).toEqual(["s-1", "s-2"]);
	});

	it("walks TikTok bulk shapes such as budgets: [{ adgroup_id, budget }]", () => {
		expect(
			extractAdsTargetEntityIds("tiktok-ads", "adgroup/budget/update/", {
				advertiser_id: "adv-1",
				budgets: [
					{ adgroup_id: 1, budget: 20 },
					{ adgroup_id: 2, budget: 30 },
				],
			}),
		).toEqual(["1", "2"]);
	});

	it("finds ids nested under tool_execute params wrappers", () => {
		expect(
			extractAdsTargetEntityIds("tiktok-ads", "tool_execute", {
				params: { adgroup_ids: ["777", "778"], operation_status: "DISABLE" },
				tool_name: "adgroup/status/update/",
			}),
		).toEqual(["777", "778"]);
		expect(
			extractAdsTargetEntityIds("tiktok-ads", "tool_execute", {
				params: { adgroup_id: "777", operation_status: "DISABLE" },
				tool_name: "adgroup/status/update/",
			}),
		).toEqual(["777"]);
		expect(
			extractAdsTargetEntityIds("tiktok-ads", "tool_execute", {
				params: { body: { campaign_ids: ["x"], campaign_id: "888" } },
				tool_name: "campaign/update/",
			}),
		).toEqual(["x", "888"]);
	});

	it("does not look deeper than three levels", () => {
		expect(
			extractAdsTargetEntityIds("meta-ads", "update_campaign", {
				a: { b: { c: { d: { campaign_id: "deep" } } } },
			}),
		).toEqual([]);
	});

	it("uses generic id keys only when the tool name names a level", () => {
		expect(
			extractAdsTargetEntityIds("meta-ads", "update_adset", { id: "999" }),
		).toEqual(["999"]);
		expect(
			extractAdsTargetEntityIds("meta-ads", "campaign_update", {
				object_id: "1000",
			}),
		).toEqual(["1000"]);
		expect(
			extractAdsTargetEntityIds("meta-ads", "update_ad_status", {
				node_id: "1001",
			}),
		).toEqual(["1001"]);
		expect(
			extractAdsTargetEntityIds("meta-ads", "update_page", { id: "1002" }),
		).toEqual([]);
		expect(
			extractAdsTargetEntityIds("meta-ads", "upload_image", { id: "1003" }),
		).toEqual([]);
	});

	it("returns nothing for blank or non-id values", () => {
		expect(
			extractAdsTargetEntityIds("meta-ads", "update_campaign", {
				campaign_id: "   ",
			}),
		).toEqual([]);
		expect(
			extractAdsTargetEntityIds("meta-ads", "update_campaign", {
				campaign_id: { nested: true },
			}),
		).toEqual([]);
		expect(
			extractAdsTargetEntityIds("meta-ads", "update_campaign", {
				campaign_ids: [{ nested: true }, null, ""],
			}),
		).toEqual([]);
		expect(
			extractAdsTargetEntityIds("meta-ads", "update_campaign", null),
		).toEqual([]);
		expect(
			extractAdsTargetEntityIds("meta-ads", "update_campaign", "string"),
		).toEqual([]);
	});
});

describe("extractAdsCreatedEntityIds", () => {
	it("reads the Meta id from JSON text content and from a plain object", () => {
		expect(
			extractAdsCreatedEntityIds(
				"meta-ads",
				"ads_create_campaign",
				textResult({ id: "123" }),
			),
		).toEqual(["123"]);
		expect(
			extractAdsCreatedEntityIds("meta-ads", "campaign_create", {
				id: "123",
			}),
		).toEqual(["123"]);
	});

	it("reads TikTok ids under data, data.list[0] and data.*", () => {
		expect(
			extractAdsCreatedEntityIds(
				"tiktok-ads",
				"adgroup/create/",
				textResult({ code: 0, data: { adgroup_id: "777" } }),
			),
		).toEqual(["777"]);
		expect(
			extractAdsCreatedEntityIds(
				"tiktok-ads",
				"ad/create/",
				textResult({ code: 0, data: { ad_ids: ["1", "2"], adgroup_id: "7" } }),
			),
		).toEqual(["1", "2"]);
		expect(
			extractAdsCreatedEntityIds(
				"tiktok-ads",
				"campaign/create/",
				textResult({ code: 0, data: { list: [{ campaign_id: 55 }] } }),
			),
		).toEqual(["55"]);
		expect(
			extractAdsCreatedEntityIds(
				"tiktok-ads",
				"campaign/create/",
				textResult({ code: 0, data: { campaign: { campaign_id: "66" } } }),
			),
		).toEqual(["66"]);
	});

	it("returns nothing for failures, non-creates and other connectors", () => {
		expect(
			extractAdsCreatedEntityIds(
				"tiktok-ads",
				"campaign/create/",
				textResult({ code: 40002, data: { campaign_id: "1" } }),
			),
		).toEqual([]);
		expect(
			extractAdsCreatedEntityIds(
				"meta-ads",
				"ads_create_campaign",
				textResult({ error: { code: 100 }, id: "1" }),
			),
		).toEqual([]);
		expect(
			extractAdsCreatedEntityIds("meta-ads", "ads_update_campaign", {
				id: "1",
			}),
		).toEqual([]);
		expect(
			extractAdsCreatedEntityIds("higgsfield", "create_image", { id: "1" }),
		).toEqual([]);
		expect(
			extractAdsCreatedEntityIds(
				"meta-ads",
				"ads_create_campaign",
				textResult("not json at all"),
			),
		).toEqual([]);
		expect(
			extractAdsCreatedEntityIds("meta-ads", "ads_create_campaign", {
				content: [{ text: "plain text", type: "text" }],
			}),
		).toEqual([]);
	});
});

describe("adsPlatformError", () => {
	it("flags TikTok non-zero codes and Meta error objects", () => {
		expect(adsPlatformError("tiktok-ads", { code: 40002 })).toEqual({
			errorCode: "40002",
		});
		expect(adsPlatformError("tiktok-ads", { code: 0, data: {} })).toBeNull();
		expect(adsPlatformError("tiktok-ads", { code: "40002" })).toBeNull();
		expect(
			adsPlatformError("meta-ads", { error: { code: 100, message: "x" } }),
		).toEqual({ errorCode: "100" });
		expect(adsPlatformError("meta-ads", { error: { message: "x" } })).toEqual({
			errorCode: null,
		});
		expect(adsPlatformError("meta-ads", { error: "string" })).toBeNull();
		expect(adsPlatformError("meta-ads", { id: "1" })).toBeNull();
		expect(adsPlatformError("higgsfield", { code: 5 })).toBeNull();
	});
});

describe("isAdsCreateToolName", () => {
	it("matches create verbs as whole tokens only", () => {
		expect(isAdsCreateToolName("ads_create_ad")).toBe(true);
		expect(isAdsCreateToolName("campaign/create/")).toBe(true);
		expect(isAdsCreateToolName("add_ad_to_adset")).toBe(true);
		expect(isAdsCreateToolName("upload_ad_image")).toBe(true);
		expect(isAdsCreateToolName("publish_ad")).toBe(true);
		expect(isAdsCreateToolName("ads_update_ad_additional_fields")).toBe(false);
		expect(isAdsCreateToolName("update_address")).toBe(false);
		expect(isAdsCreateToolName("update_adset")).toBe(false);
	});
});

describe("levelFromToolName", () => {
	it("picks the most specific level named by the tool", () => {
		expect(levelFromToolName("update_campaign")).toBe("campaign");
		expect(levelFromToolName("adgroup/update/")).toBe("adset");
		expect(levelFromToolName("update_ad")).toBe("ad");
		expect(levelFromToolName("campaign_ad_update")).toBe("ad");
		expect(levelFromToolName("upload_image")).toBeNull();
	});

	it("ignores the Meta ads_ prefix and ad accounts", () => {
		expect(levelFromToolName("ads_update_adset")).toBe("adset");
		expect(levelFromToolName("ads_update_campaign")).toBe("campaign");
		expect(levelFromToolName("ads_create_ad")).toBe("ad");
		expect(levelFromToolName("ads_get_ad_accounts")).toBeNull();
		expect(levelFromToolName("ads_get_campaigns")).toBe("campaign");
		expect(levelFromToolName("ads_update_page")).toBeNull();
		expect(levelFromToolName("get_ads")).toBe("ad");
		expect(levelFromToolName("campaign_ads_list")).toBe("campaign");
	});
});
