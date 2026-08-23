import { describe, expect, it } from "vitest";

import { isOutOfCredits } from "./out-of-credits";

// The raw balance carries the hold; the gate must read the settled value.
function balanceOf(settledBalance: number, balance = settledBalance) {
	return {
		plan: balance,
		promo: 0,
		topup: 0,
		balance,
		settledBalance,
		settledPlan: settledBalance,
		settledPromo: 0,
		settledTopup: 0,
	};
}

describe("isOutOfCredits", () => {
	it("never blocks while the balance is unknown", () => {
		expect(isOutOfCredits(undefined)).toBe(false);
	});

	it("does not block a positive balance", () => {
		expect(isOutOfCredits(balanceOf(1))).toBe(false);
		expect(isOutOfCredits(balanceOf(50))).toBe(false);
	});

	it("does not block a fractional balance below the chat reserve floor", () => {
		// 0.05 < the 0.10 reserve floor, but the server's 402 is the authority.
		expect(isOutOfCredits(balanceOf(0.05))).toBe(false);
	});

	it("ignores a reserve hold that pushes only the raw balance to zero", () => {
		expect(isOutOfCredits(balanceOf(0.5, -0.5))).toBe(false);
	});

	it("blocks at exactly zero", () => {
		expect(isOutOfCredits(balanceOf(0))).toBe(true);
	});

	it("blocks a negative balance (settle overage past the reserve)", () => {
		expect(isOutOfCredits(balanceOf(-3))).toBe(true);
		expect(isOutOfCredits(balanceOf(-0.01))).toBe(true);
	});
});
