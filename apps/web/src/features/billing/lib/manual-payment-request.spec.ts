import { describe, expect, it } from "vitest";

import { assembleManualSubscriptionRequestBody } from "./manual-payment-request";

describe("manual subscription request body", () => {
	it("assembles and trims a complete request", () => {
		expect(
			assembleManualSubscriptionRequestBody(100, {
				city: "  Alger  ",
				company: "  Acme  ",
				country: "DZ",
				fullName: "  Ada Lovelace  ",
				notes: "  Call after 5  ",
				phone: "  +213 555 12 34 56  ",
				preferredPaymentMethod: "ccp",
			}),
		).toEqual({
			amountUsd: 100,
			city: "Alger",
			company: "Acme",
			country: "DZ",
			fullName: "Ada Lovelace",
			notes: "Call after 5",
			phone: "+213 555 12 34 56",
			preferredPaymentMethod: "ccp",
		});
	});

	it("omits blank optional fields", () => {
		expect(
			assembleManualSubscriptionRequestBody(25, {
				city: " ",
				company: "",
				country: "TN",
				fullName: "Leila Ben Ali",
				notes: "\n",
				phone: "+216 20 000 000",
				preferredPaymentMethod: "",
			}),
		).toEqual({
			amountUsd: 25,
			city: undefined,
			company: undefined,
			country: "TN",
			fullName: "Leila Ben Ali",
			notes: undefined,
			phone: "+216 20 000 000",
			preferredPaymentMethod: undefined,
		});
	});
});
