import { describe, expect, it } from "vitest";

import { buildWeekStreaks } from "./build-weeks";

// Friday 2026-11-20 12:00 UTC. Its ISO week starts on Monday 2026-11-16.
const NOW = new Date("2026-11-20T12:00:00.000Z");

/** `recent` with true at the given offsets. Offset 0 is this week, -1 is last week. */
function recentWith(...offsets: number[]): boolean[] {
	return Array.from({ length: 12 }, (_, index) => offsets.includes(index - 11));
}

describe("buildWeekStreaks", () => {
	it("gives zero streaks and an empty strip for no build week", () => {
		expect(buildWeekStreaks([], NOW)).toEqual({
			bestStreak: 0,
			currentStreak: 0,
			recent: recentWith(),
		});
	});

	it("counts one run that ends this week, in any input order, with repeats", () => {
		expect(
			buildWeekStreaks(
				["2026-11-09", "2026-11-16", "2026-11-02", "2026-11-16"],
				NOW,
			),
		).toEqual({
			bestStreak: 3,
			currentStreak: 3,
			recent: recentWith(-2, -1, 0),
		});
	});

	it("breaks the current streak at a gap of one week and keeps the older best run", () => {
		expect(
			buildWeekStreaks(
				["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-09", "2026-11-16"],
				NOW,
			),
		).toEqual({
			bestStreak: 3,
			currentStreak: 2,
			recent: recentWith(-5, -4, -3, -1, 0),
		});
	});

	it("counts from last week when this week has no build yet", () => {
		const result = buildWeekStreaks(["2026-11-02", "2026-11-09"], NOW);
		expect(result.currentStreak).toBe(2);
		expect(result.recent[11]).toBe(false);
	});

	it("keeps a run across the ISO year edge (week 53 of 2026 to week 1 of 2027)", () => {
		// Monday 2027-01-04 starts ISO week 1 of 2027. Monday 2026-12-28 starts ISO week 53 of 2026.
		const result = buildWeekStreaks(
			["2026-12-21", "2026-12-28", "2027-01-04"],
			new Date("2027-01-10T23:59:00.000Z"),
		);
		expect(result.currentStreak).toBe(3);
		expect(result.bestStreak).toBe(3);
	});
});
