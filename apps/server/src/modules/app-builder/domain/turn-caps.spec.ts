import { describe, expect, it } from "vitest";

import { monthStartUtc } from "./turn-caps";

describe("monthStartUtc", () => {
	it("returns the first instant of the month for a mid-month date", () => {
		expect(monthStartUtc(new Date("2026-09-16T12:34:56.789Z"))).toEqual(
			new Date("2026-09-01T00:00:00.000Z"),
		);
	});

	it("returns the same instant at the first millisecond of a month", () => {
		expect(monthStartUtc(new Date("2026-10-01T00:00:00.000Z"))).toEqual(
			new Date("2026-10-01T00:00:00.000Z"),
		);
	});

	it("stays in the same year on 31 December", () => {
		expect(monthStartUtc(new Date("2026-12-31T23:59:59.999Z"))).toEqual(
			new Date("2026-12-01T00:00:00.000Z"),
		);
	});
});
