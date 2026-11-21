import { describe, expect, it } from "vitest";

import { orgOwner, userOwner } from "../../credits/domain/credit-owner";
import {
	billableMinutes,
	DEVICE_MINUTES_PER_PAID_OWNER,
	deviceMinutesLeft,
	deviceMinutesPerMonth,
} from "./device-minutes";

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

describe("deviceMinutesPerMonth", () => {
	it.each([
		{ isPaidOwner: false, owner: userOwner("user_1"), minutes: 0 },
		{ isPaidOwner: false, owner: orgOwner("org_1"), minutes: 0 },
		{
			isPaidOwner: true,
			owner: userOwner("user_1"),
			minutes: DEVICE_MINUTES_PER_PAID_OWNER.user,
		},
		{
			isPaidOwner: true,
			owner: orgOwner("org_1"),
			minutes: DEVICE_MINUTES_PER_PAID_OWNER.org,
		},
	])("paid=$isPaidOwner $owner.type owner gets $minutes", ({
		isPaidOwner,
		owner,
		minutes,
	}) => {
		expect(deviceMinutesPerMonth(isPaidOwner, owner)).toBe(minutes);
	});
});

describe("deviceMinutesLeft", () => {
	it("subtracts the used minutes and never goes below 0", () => {
		expect(deviceMinutesLeft(60, 10)).toBe(50);
		expect(deviceMinutesLeft(60, 75)).toBe(0);
	});
});
