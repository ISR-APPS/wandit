import { describe, expect, it } from "vitest";

import {
	floorCreditBalance,
	formatCreditAmount,
	formatCreditBalance,
	roundCreditAmount,
} from "./credit-format";

describe("floorCreditBalance", () => {
	it("floors to one decimal and never rounds up", () => {
		expect(floorCreditBalance(37)).toBe(37);
		expect(floorCreditBalance(2.99)).toBe(2.9);
		expect(floorCreditBalance(0.09)).toBe(0);
	});
});

describe("roundCreditAmount", () => {
	it("snaps float dust back to 0.01-credit steps", () => {
		expect(roundCreditAmount(0.1 + 0.2)).toBe(0.3);
		expect(roundCreditAmount(-0.87)).toBe(-0.87);
		expect(roundCreditAmount(760.456)).toBe(760.46);
	});
});

describe("formatCreditBalance", () => {
	it("always shows one floored decimal", () => {
		expect(formatCreditBalance(37)).toBe("37.0");
		expect(formatCreditBalance(2.99)).toBe("2.9");
		expect(formatCreditBalance(1240.55)).toBe("1,240.5");
		expect(formatCreditBalance(0)).toBe("0.0");
	});
});

describe("formatCreditAmount", () => {
	it("shows the exact amount with trailing zeros trimmed", () => {
		expect(formatCreditAmount(0.01)).toBe("0.01");
		expect(formatCreditAmount(0.87)).toBe("0.87");
		expect(formatCreditAmount(3)).toBe("3");
		expect(formatCreditAmount(20)).toBe("20");
		expect(formatCreditAmount(-0.87)).toBe("-0.87");
		expect(formatCreditAmount(12345.5)).toBe("12,345.5");
	});

	it("never renders raw float dust", () => {
		expect(formatCreditAmount(0.1 + 0.2)).toBe("0.3");
	});
});
