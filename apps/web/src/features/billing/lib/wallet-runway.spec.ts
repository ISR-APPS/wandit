import { describe, expect, it } from "vitest";

import { walletRunwayDays } from "./wallet-runway";

describe("walletRunwayDays", () => {
	it.each([
		["no spend", 300, 0, null],
		["a negative balance", -5, 100, null],
		["a zero balance", 0, 100, null],
		["300 credits at 100 per 30 days", 300, 100, 90],
		["a part day rounds down", 11, 100, 3],
		["less than one day", 1, 100, 0],
		["an exact ratio", 23, 23, 30],
	])("%s -> %s", (_case, balance, spent, expected) => {
		expect(walletRunwayDays(balance, spent)).toBe(expected);
	});
});
