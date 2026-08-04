import { describe, expect, it } from "vitest";
import { LeadsCaptureThrottle } from "./leads-capture-throttle";

describe("LeadsCaptureThrottle", () => {
	it("allows 60 submissions per form and IP, then returns an exact retry delay", () => {
		const throttle = new LeadsCaptureThrottle();
		const now = 1_000_000;

		for (let i = 0; i < 60; i += 1) {
			expect(throttle.consume("form-a", "1.2.3.4", now)).toEqual({
				allowed: true,
			});
		}
		expect(throttle.consume("form-a", "1.2.3.4", now)).toEqual({
			allowed: false,
			retryAfterSeconds: 60,
		});
	});

	it("frees the budget when the sliding window expires", () => {
		const throttle = new LeadsCaptureThrottle();
		const now = 1_000_000;

		for (let i = 0; i < 60; i += 1) {
			throttle.consume("form-a", "1.2.3.4", now);
		}
		expect(throttle.consume("form-a", "1.2.3.4", now + 59_001)).toEqual({
			allowed: false,
			retryAfterSeconds: 1,
		});
		expect(throttle.consume("form-a", "1.2.3.4", now + 60_000)).toEqual({
			allowed: true,
		});
	});

	it("isolates the retail budget by form and IP", () => {
		const throttle = new LeadsCaptureThrottle();
		const now = 1_000_000;

		for (let i = 0; i < 60; i += 1) {
			throttle.consume("form-a", "1.2.3.4", now);
		}
		expect(throttle.consume("form-a", "1.2.3.4", now).allowed).toBe(false);
		expect(throttle.consume("form-b", "1.2.3.4", now)).toEqual({
			allowed: true,
		});
		expect(throttle.consume("form-a", "5.6.7.8", now)).toEqual({
			allowed: true,
		});
	});

	it("caps aggregate accepted submissions per IP without charging rejections", () => {
		const throttle = new LeadsCaptureThrottle();
		const now = 1_000_000;

		for (let submission = 0; submission < 60; submission += 1) {
			expect(throttle.consume("form-0", "1.2.3.4", now).allowed).toBe(true);
		}
		expect(throttle.consume("form-0", "1.2.3.4", now).allowed).toBe(false);

		for (let form = 1; form < 5; form += 1) {
			for (let submission = 0; submission < 60; submission += 1) {
				expect(throttle.consume(`form-${form}`, "1.2.3.4", now).allowed).toBe(
					true,
				);
			}
		}

		expect(throttle.consume("form-5", "1.2.3.4", now)).toEqual({
			allowed: false,
			retryAfterSeconds: 60,
		});
		expect(throttle.consume("form-5", "5.6.7.8", now)).toEqual({
			allowed: true,
		});
	});
});
