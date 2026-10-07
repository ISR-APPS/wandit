import { describe, expect, it } from "vitest";
import {
	createManualSubscriptionRequestBodySchema,
	dzdPriceFor,
	isSlickpayInvoicePaid,
	slickpayCreateInvoiceResponseSchema,
	slickpayInvoiceDetailsResponseSchema,
} from "./billing";

describe("dzdPriceFor", () => {
	// SlickPay charges whole dinars, so a fractional rate must round to the nearest dinar.
	it.each([
		[25, 270.5, 6763],
		[25, 270.01, 6750],
	])("%d USD at %d DZD per USD costs %d DZD", (priceUsd, rate, expected) => {
		expect(dzdPriceFor(priceUsd, rate)).toBe(expected);
	});
});

describe("isSlickpayInvoicePaid", () => {
	it.each([
		["completed is 1", { success: 1, completed: 1, data: {} }, true],
		["completed is the string 1", { success: 1, completed: "1" }, true],
		["completed is true", { success: true, completed: true }, true],
		[
			"payment_status is PAID in upper case",
			{ success: 1, completed: 0, data: { payment_status: "PAID" } },
			true,
		],
		[
			"completed is 0 and payment_status is unpaid",
			{ success: 1, completed: 0, data: { payment_status: "unpaid" } },
			false,
		],
		[
			"completed is the string 0 and data is missing",
			{ success: 1, completed: "0" },
			false,
		],
		[
			"the fields are null and SlickPay adds extra fields",
			{
				success: 1,
				completed: null,
				data: { payment_status: null, serial: "INV-1", amount: 6750 },
			},
			false,
		],
	])("returns the verdict when %s", (_case, raw, expected) => {
		const details = slickpayInvoiceDetailsResponseSchema.parse(raw);
		expect(isSlickpayInvoicePaid(details)).toBe(expected);
	});

	it("rejects a failed SlickPay answer, so the caller never reads it as unpaid", () => {
		const result = slickpayInvoiceDetailsResponseSchema.safeParse({
			success: 0,
			message: "Invoice not found",
		});
		expect(result.success).toBe(false);
	});
});

describe("slickpayCreateInvoiceResponseSchema", () => {
	it.each([
		["javascript:alert(1)"],
		["http://devapi.slick-pay.com/satim/payment/1"],
	])("rejects the payment URL %s, so the web never redirects the buyer to it", (url) => {
		const result = slickpayCreateInvoiceResponseSchema.safeParse({
			success: 1,
			id: 1,
			url,
		});
		expect(result.success).toBe(false);
	});
});

describe("createManualSubscriptionRequestBodySchema", () => {
	// SlickPay has its own checkout. A customer offline request must not store "slickpay".
	it.each([
		["ccp", true],
		["slickpay", false],
	])("accepts the preferred method %s: %s", (preferredPaymentMethod, expected) => {
		const result = createManualSubscriptionRequestBodySchema.safeParse({
			plan: "pro",
			tierCredits: 500,
			interval: "month",
			fullName: "Amina Example",
			phone: "+213 661 22 33 44",
			country: "DZ",
			preferredPaymentMethod,
		});
		expect(result.success).toBe(expected);
	});
});
