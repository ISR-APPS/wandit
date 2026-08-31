import { describe, expect, it } from "vitest";

import {
	getVisibleAdminNavigation,
	getVisibleAdminNavigationGroups,
} from "./navigation";

describe("admin navigation permissions", () => {
	it("shows support only the sections granted by the shared matrix", () => {
		const titles = getVisibleAdminNavigation("support").map(
			(item) => item.title,
		);

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
		expect(titles).not.toContain("Affiliates");
		expect(titles).not.toContain("Costs");
		expect(titles).not.toContain("Settings");
		expect(titles).not.toContain("Revenue");
		expect(titles).not.toContain("AI failures");
	});

	it("drops groups that have no visible items", () => {
		expect(
			getVisibleAdminNavigationGroups("support").map((group) => group.title),
		).toEqual(["Operations"]);
		expect(getVisibleAdminNavigationGroups("user")).toEqual([]);
	});

	it("shows every section to a full admin, including comma-joined roles", () => {
		const items = getVisibleAdminNavigation("user,admin");

		expect(items).toHaveLength(18);
		expect(items.map((item) => item.title)).toContain("AI failures");
		expect(getVisibleAdminNavigationGroups("user,admin")).toHaveLength(2);
	});
});
