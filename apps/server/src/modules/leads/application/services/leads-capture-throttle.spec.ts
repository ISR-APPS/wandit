import { describe, expect, it } from "vitest";
import { LeadsCaptureThrottle } from "./leads-capture-throttle";

describe("LeadsCaptureThrottle", () => {
	it("allows up to the budget inside one window, then refuses", () => {
		const throttle = new LeadsCaptureThrottle();
		const now = 1_000_000;

		for (let i = 0; i < 10; i += 1) {
			expect(throttle.allow("1.2.3.4", now + i)).toBe(true);
		}
		expect(throttle.allow("1.2.3.4", now + 10)).toBe(false);
	});

	it("frees the budget once the window slides past", () => {
		const throttle = new LeadsCaptureThrottle();
		const now = 1_000_000;

		for (let i = 0; i < 10; i += 1) {
			throttle.allow("1.2.3.4", now);
		}
		expect(throttle.allow("1.2.3.4", now + 59_000)).toBe(false);
		expect(throttle.allow("1.2.3.4", now + 61_000)).toBe(true);
	});

	it("keys per IP", () => {
		const throttle = new LeadsCaptureThrottle();
		const now = 1_000_000;

		for (let i = 0; i < 10; i += 1) {
			throttle.allow("1.2.3.4", now);
		}
		expect(throttle.allow("1.2.3.4", now)).toBe(false);
		expect(throttle.allow("5.6.7.8", now)).toBe(true);
	});
});
