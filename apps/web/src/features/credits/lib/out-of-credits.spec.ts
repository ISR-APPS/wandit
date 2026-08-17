import { describe, expect, it } from "vitest";

import { isOutOfCredits } from "./out-of-credits";

function balanceOf(balance: number) {
	return {
		plan: balance,
		promo: 0,
		topup: 0,
		balance,
		settledBalance: balance,
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

	it("blocks at exactly zero", () => {
		expect(isOutOfCredits(balanceOf(0))).toBe(true);
	});

	it("blocks a negative balance (settle overage past the reserve)", () => {
		expect(isOutOfCredits(balanceOf(-3))).toBe(true);
		expect(isOutOfCredits(balanceOf(-0.01))).toBe(true);
	});
});
