import { describe, expect, it } from "vitest";

import { billableMinutes, deviceMinutesLeft } from "./device-minutes";

const START = new Date("2026-09-26T10:00:00.000Z");

/** The instant `ms` after START. */
function startPlus(ms: number): Date {
	return new Date(START.getTime() + ms);
}

describe("billableMinutes", () => {
	it.each([
		[0, 0],
		[1, 1],
		[59_999, 1],
		[60_000, 1],
		[60_001, 2],
		[900_000, 15],
	])("bills %i ms as %i minutes, rounded up", (elapsedMs, minutes) => {
		expect(billableMinutes(START, startPlus(elapsedMs))).toBe(minutes);
	});

	it("bills 0 when the close is before the start", () => {
		expect(billableMinutes(START, startPlus(-5_000))).toBe(0);
	});
});

describe("deviceMinutesLeft", () => {
	it("gives a starter payer no minutes", () => {
		expect(deviceMinutesLeft("starter", 0)).toBe(0);
	});

	it("subtracts the used minutes and never goes below 0", () => {
		expect(deviceMinutesLeft("pro", 10)).toBe(50);
		expect(deviceMinutesLeft("pro", 75)).toBe(0);
		expect(deviceMinutesLeft("business", 0)).toBe(180);
	});
});
