import { describe, expect, it } from "vitest";

import {
	assembleManualSubscriptionRequestBody,
	stepForInvalidFields,
} from "./manual-payment-request";

describe("manual subscription request body", () => {
	it("assembles and trims a complete request", () => {
		expect(
			assembleManualSubscriptionRequestBody(
				{ interval: "year", plan: "pro", tierCredits: 1000 },
				{
					city: "  Alger  ",
					company: "  Acme  ",
					country: "DZ",
					fullName: "  Ada Lovelace  ",
					notes: "  Call after 5  ",
					phone: "  +213 555 12 34 56  ",
					preferredPaymentMethod: "ccp",
				},
			),
		).toEqual({
			city: "Alger",
			company: "Acme",
			country: "DZ",
			fullName: "Ada Lovelace",
			interval: "year",
			notes: "Call after 5",
			phone: "+213 555 12 34 56",
			plan: "pro",
			preferredPaymentMethod: "ccp",
			tierCredits: 1000,
		});
	});

	it("omits blank optional fields", () => {
		expect(
			assembleManualSubscriptionRequestBody(
				{ interval: "month", plan: "business", tierCredits: 250 },
				{
					city: " ",
					company: "",
					country: "TN",
					fullName: "Leila Ben Ali",
					notes: "\n",
					phone: "+216 20 000 000",
					preferredPaymentMethod: "",
				},
			),
		).toEqual({
			city: undefined,
			company: undefined,
			country: "TN",
			fullName: "Leila Ben Ali",
			interval: "month",
			notes: undefined,
			phone: "+216 20 000 000",
			plan: "business",
			preferredPaymentMethod: undefined,
			tierCredits: 250,
		});
	});

	it("assembles a Starter request with its single purchasable tier", () => {
		expect(
			assembleManualSubscriptionRequestBody(
				{ interval: "month", plan: "starter", tierCredits: 60 },
				{
					city: "",
					company: "",
					country: "DZ",
					fullName: "Ada Lovelace",
					notes: "",
					phone: "+213 555 12 34 56",
					preferredPaymentMethod: "",
				},
			),
		).toMatchObject({
			interval: "month",
			plan: "starter",
			tierCredits: 60,
		});
	});
});

describe("stepForInvalidFields", () => {
	it("returns the plan step when a plan-level field is invalid", () => {
		expect(stepForInvalidFields(["interval", "phone"])).toBe("plan");
		expect(stepForInvalidFields(["tierCredits"])).toBe("plan");
		expect(stepForInvalidFields(["plan"])).toBe("plan");
	});

	it("returns the contact step for contact-only or empty issues", () => {
		expect(stepForInvalidFields(["phone", "fullName"])).toBe("contact");
		expect(stepForInvalidFields([])).toBe("contact");
	});
});
