import { desktopBuildStatuses } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	desktopBinaryName,
	desktopStatusesThatMayMoveTo,
} from "./desktop-build";

describe("desktopStatusesThatMayMoveTo", () => {
	// A move out of `ready` would let a cancel release a settled hold, and a
	// move out of `failed` would let the task settle a released one.
	it("never moves a build that ended", () => {
		const ended = ["ready", "failed", "canceled", "blocked"];
		for (const to of desktopBuildStatuses) {
			expect(
				desktopStatusesThatMayMoveTo(to).filter((from) => ended.includes(from)),
			).toEqual([]);
		}
	});

	// The gate runs in `preparing` and the signature in `signing`; a skipped
	// step would ship unchecked SQL or an unsigned installer.
	it.each([
		{ to: "building", from: ["preparing"] },
		{ to: "blocked", from: ["preparing"] },
		{ to: "ready", from: ["signing"] },
	] as const)("lets only $from move to $to", ({ to, from }) => {
		expect(desktopStatusesThatMayMoveTo(to)).toEqual(from);
	});
});

describe("desktopBinaryName", () => {
	it.each([
		{ productName: "Stock Manager", expected: "stock-manager" },
		{ productName: "Café Crème 2", expected: "cafe-creme-2" },
		{ productName: "  --Gestion__Ventes--  ", expected: "gestion-ventes" },
		{ productName: "مدير المخزون", expected: "app" },
		{ productName: "Con", expected: "con-app" },
		// The cut at 40 characters lands on a dash, which goes too.
		{
			productName: "Inventory Tracker For The Whole Shop Ab Cd",
			expected: "inventory-tracker-for-the-whole-shop-ab",
		},
	])("names $productName as $expected", ({ productName, expected }) => {
		expect(desktopBinaryName(productName)).toBe(expected);
	});
});
