import { describe, expect, it } from "vitest";

import { USER_PLAN_FILTER_OPTIONS } from "./constants";

describe("user filter constants", () => {
	it("lists every plan in product order", () => {
		expect(USER_PLAN_FILTER_OPTIONS).toEqual([
			{ label: "Free", value: "free" },
			{ label: "Starter", value: "starter" },
			{ label: "Pro", value: "pro" },
			{ label: "Business", value: "business" },
		]);
	});
});
