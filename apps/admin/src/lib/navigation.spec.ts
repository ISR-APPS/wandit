import {
	adminStatement,
	defaultSupportViews,
	supportStatementsForViews,
} from "@wandit/auth/admin-permissions";
import { describe, expect, it } from "vitest";

import {
	getVisibleAdminNavigation,
	getVisibleAdminNavigationGroups,
} from "./navigation";

describe("admin navigation permissions", () => {
	it("shows support only the sections granted by the shared matrix", () => {
		const titles = getVisibleAdminNavigation(
			supportStatementsForViews(defaultSupportViews),
		).map((item) => item.title);

		expect(titles).toEqual([
			"Overview",
			"Users",
			"Organizations",
			"Offline billing",
			"Publications",
			"Feedback",
			"Links",
			"Academy",
		]);
		expect(titles).not.toContain("Credit grants");
		expect(titles).not.toContain("Affiliates");
		expect(titles).not.toContain("Costs");
		expect(titles).not.toContain("Settings");
		expect(titles).not.toContain("Revenue");
		expect(titles).not.toContain("AI failures");
	});

	it("drops groups that have no visible items", () => {
		expect(
			getVisibleAdminNavigationGroups(
				supportStatementsForViews(defaultSupportViews),
			).map((group) => group.title),
		).toEqual(["Operations"]);
		expect(getVisibleAdminNavigationGroups({})).toEqual([]);
	});

	it("shows every section to a full admin map", () => {
		const items = getVisibleAdminNavigation(adminStatement);

		expect(items).toHaveLength(19);
		expect(items.map((item) => item.title)).toContain("AI failures");
		expect(getVisibleAdminNavigationGroups(adminStatement)).toHaveLength(2);
	});

	it("shows the credit grant log to support only with the credits view", () => {
		const titles = getVisibleAdminNavigation(
			supportStatementsForViews(["users", "credits"]),
		).map((item) => item.title);

		expect(titles).toEqual(["Users", "Credit grants"]);
	});

	it("hides navigation whose view is absent from a support map", () => {
		const items = getVisibleAdminNavigation(
			supportStatementsForViews(["users", "conversations"]),
		);

		expect(items.map((item) => item.title)).toEqual(["Users", "AI failures"]);
		expect(items.map((item) => item.title)).not.toContain("Overview");
		expect(items.map((item) => item.title)).not.toContain("Revenue");
	});
});
