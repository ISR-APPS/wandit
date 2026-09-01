import { adminViewValues } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	ADMIN_VIEW_LABELS,
	getInitialAdminViews,
	hasAtLeastOneAdminView,
} from "./admin-view-options";

describe("admin view options", () => {
	it("has a label and description for every contract view", () => {
		expect(Object.keys(ADMIN_VIEW_LABELS)).toEqual([...adminViewValues]);
		for (const view of adminViewValues) {
			expect(ADMIN_VIEW_LABELS[view].label).not.toBe("");
			expect(ADMIN_VIEW_LABELS[view].description).not.toBe("");
		}
	});

	it("uses stored support grants and defaults every other case", () => {
		expect(getInitialAdminViews("support", ["users", "feedback"])).toEqual([
			"users",
			"feedback",
		]);
		expect(getInitialAdminViews("support", null)).toEqual([
			"overview",
			"users",
			"organizations",
			"billing",
			"publications",
			"feedback",
			"links",
			"academy",
		]);
		expect(getInitialAdminViews("user", ["settings"])).toEqual(
			getInitialAdminViews("support", null),
		);
	});

	it("requires one selected view", () => {
		expect(hasAtLeastOneAdminView([])).toBe(false);
		expect(hasAtLeastOneAdminView(["overview"])).toBe(true);
	});
});
