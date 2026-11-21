import { describe, expect, it } from "vitest";

import {
	meterPositionToUsd,
	parseTopupAmountUsd,
	TOPUP_METER_MAX_POSITION,
	TOPUP_METER_STOPS_USD,
	usdToMeterPosition,
} from "./topup-amount";

const LIMITS = { minAmountUsd: 10, maxAmountUsd: 1000 };

describe("parseTopupAmountUsd", () => {
	it.each([
		["25", { kind: "valid", amountUsd: 25 }],
		[" 25 ", { kind: "valid", amountUsd: 25 }],
		["010", { kind: "valid", amountUsd: 10 }],
		["1000", { kind: "valid", amountUsd: 1000 }],
		["٢٥", { kind: "valid", amountUsd: 25 }],
		["۱۰۰", { kind: "valid", amountUsd: 100 }],
		["", { kind: "empty" }],
		["   ", { kind: "empty" }],
		["9", { kind: "belowMinimum" }],
		["0", { kind: "belowMinimum" }],
		["1001", { kind: "aboveMaximum" }],
		["99999999999999999999", { kind: "aboveMaximum" }],
		["25,5", { kind: "notWholeNumber" }],
		["25.5", { kind: "notWholeNumber" }],
		["25.00", { kind: "notWholeNumber" }],
		["-25", { kind: "notWholeNumber" }],
		["+25", { kind: "notWholeNumber" }],
		["1 000", { kind: "notWholeNumber" }],
		["1e3", { kind: "notWholeNumber" }],
		["0x10", { kind: "notWholeNumber" }],
		["abc", { kind: "notWholeNumber" }],
		["$25", { kind: "notWholeNumber" }],
	] as const)("%j -> %o", (text, expected) => {
		expect(parseTopupAmountUsd(text, LIMITS)).toEqual(expected);
	});
});

describe("Spark Meter scale", () => {
	it.each(TOPUP_METER_STOPS_USD)("round trips the stop %i USD", (usd) => {
		expect(meterPositionToUsd(usdToMeterPosition(usd))).toBe(usd);
	});

	it("maps a position between two stops linearly and back", () => {
		// Position 450 is the middle of the 200 to 500 segment.
		expect(meterPositionToUsd(450)).toBe(350);
		expect(usdToMeterPosition(350)).toBe(450);
	});

	it("never lowers the USD value when the position goes up", () => {
		let previousUsd = meterPositionToUsd(0);
		for (let position = 1; position <= TOPUP_METER_MAX_POSITION; position++) {
			const usd = meterPositionToUsd(position);
			expect(usd).toBeGreaterThanOrEqual(previousUsd);
			previousUsd = usd;
		}
		expect(previousUsd).toBe(1000);
	});
});
