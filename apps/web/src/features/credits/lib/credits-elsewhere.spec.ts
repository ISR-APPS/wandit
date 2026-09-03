import {
	PERSONAL_WORKSPACE,
	type WorkspaceCreditBalance,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { findCreditsElsewhere } from "./credits-elsewhere";

function row(
	workspaceId: string,
	settledBalance: number,
	balance = settledBalance,
): WorkspaceCreditBalance {
	return {
		workspaceId,
		name: workspaceId === PERSONAL_WORKSPACE ? null : `Team ${workspaceId}`,
		balance,
		settledBalance,
	};
}

describe("findCreditsElsewhere", () => {
	it("stays silent while the balances list is unloaded", () => {
		expect(findCreditsElsewhere(PERSONAL_WORKSPACE, undefined)).toBeNull();
	});

	it("stays silent when the active workspace is missing from the list", () => {
		expect(
			findCreditsElsewhere("org-gone", [row(PERSONAL_WORKSPACE, 40)]),
		).toBeNull();
	});

	it("stays silent while the active workspace still has settled credits", () => {
		const items = [row(PERSONAL_WORKSPACE, 0.1), row("org-1", 90)];

		expect(findCreditsElsewhere(PERSONAL_WORKSPACE, items)).toBeNull();
	});

	it("judges the active workspace by settledBalance, not balance", () => {
		// A reserve hold dips balance to 0 mid-generation; settled adds it back.
		const items = [row(PERSONAL_WORKSPACE, 5, 0), row("org-1", 90)];

		expect(findCreditsElsewhere(PERSONAL_WORKSPACE, items)).toBeNull();
	});

	it("stays silent when no other workspace has settled credits", () => {
		const items = [
			row(PERSONAL_WORKSPACE, 0),
			row("org-1", 0),
			row("org-2", -2),
		];

		expect(findCreditsElsewhere(PERSONAL_WORKSPACE, items)).toBeNull();
	});

	it("points at the other workspace once the active pool is drained", () => {
		const items = [row(PERSONAL_WORKSPACE, 0), row("org-1", 12.5)];

		expect(findCreditsElsewhere(PERSONAL_WORKSPACE, items)).toEqual(
			row("org-1", 12.5),
		);
	});

	it("fires on a negative active balance (settle overage)", () => {
		const items = [row("org-1", -3), row(PERSONAL_WORKSPACE, 8)];

		expect(findCreditsElsewhere("org-1", items)).toEqual(
			row(PERSONAL_WORKSPACE, 8),
		);
	});

	it("picks the richest settled pool among several candidates", () => {
		const items = [
			row(PERSONAL_WORKSPACE, 0),
			row("org-1", 3),
			row("org-2", 47),
			row("org-3", 15),
		];

		expect(findCreditsElsewhere(PERSONAL_WORKSPACE, items)?.workspaceId).toBe(
			"org-2",
		);
	});

	it("ignores other pools that settle to zero once holds are added back", () => {
		// balance dipped to -2 by a 2-credit reserve hold; settled reads 0.
		const items = [row(PERSONAL_WORKSPACE, 0), row("org-1", 0, -2)];

		expect(findCreditsElsewhere(PERSONAL_WORKSPACE, items)).toBeNull();
	});
});
