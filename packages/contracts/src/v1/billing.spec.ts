import { describe, expect, it } from "vitest";
import {
	createBillingTopupBodySchema,
	createManualSubscriptionRequestBodySchema,
	dzdPriceFor,
	isSlickpayInvoicePaid,
	slickpayCreateInvoiceResponseSchema,
	slickpayInvoiceDetailsResponseSchema,
	smallestTopupCovering,
	startSlickpayCheckoutBodySchema,
	topupQuoteForUsd,
} from "./billing";

describe("createBillingTopupBodySchema", () => {
	// The amount sets the Stripe charge and the credits, so a value outside 10 to 1000 whole USD must not pass.
	it.each([
		["the minimum", { amountUsd: 10 }, true],
		["the maximum", { amountUsd: 1000 }, true],
		["one USD below the minimum", { amountUsd: 9 }, false],
		["one USD above the maximum", { amountUsd: 1001 }, false],
		["a fraction of a USD", { amountUsd: 10.5 }, false],
		["an amount as a string", { amountUsd: "25" }, false],
		["a v7 pack id from a cached bundle", { packId: "topup_250" }, true],
		["a v6 pack id", { packId: "topup_175" }, false],
		["an amount and a pack id", { amountUsd: 25, packId: "topup_250" }, false],
		["the Starter pass", { starterPass: true }, true],
		["a Starter pass set to false", { starterPass: false }, false],
		// A client must not pick the price of the pass.
		[
			"the Starter pass with an amount",
			{ starterPass: true, amountUsd: 1 },
			false,
		],
	])("%s: %o -> success %s", (_case, body, expected) => {
		expect(createBillingTopupBodySchema.safeParse(body).success).toBe(expected);
	});
});

describe("startSlickpayCheckoutBodySchema", () => {
	const contact = { fullName: "Amine B", phone: "+213555123456", city: "Oran" };

	// The amount sets the DZD invoice and the credits. Only the Starter pass may go below the top-up minimum.
	it.each([
		["a top-up at the minimum", { ...contact, amountUsd: 10 }, true],
		["the Starter pass", { ...contact, starterPass: true }, true],
		["one USD as a plain top-up", { ...contact, amountUsd: 1 }, false],
		["a Starter pass set to false", { ...contact, starterPass: false }, false],
		["the Starter pass with no contact", { starterPass: true }, false],
		// A mixed body must fail. Before, it parsed as a 50 USD top-up.
		[
			"the Starter pass with an amount",
			{ ...contact, starterPass: true, amountUsd: 50 },
			false,
		],
	])("%s -> success %s", (_case, body, expected) => {
		expect(startSlickpayCheckoutBodySchema.safeParse(body).success).toBe(
			expected,
		);
	});
});

describe("topupQuoteForUsd", () => {
	// The webhook grants `credits`, so each tier edge and the rounding down of the bonus must hold.
	it.each([
		[1, 10, 0, 10],
		[10, 100, 0, 100],
		[19, 190, 0, 190],
		[20, 200, 0, 200],
		[39, 390, 0, 390],
		[40, 400, 20, 420],
		[41, 410, 20, 430],
		[99, 990, 49, 1039],
		[100, 1000, 100, 1100],
		[199, 1990, 199, 2189],
		[200, 2000, 300, 2300],
		[1000, 10000, 1500, 11500],
		[1500, 15000, 2250, 17250],
	])("%d USD gives %d base + %d bonus = %d credits", (amountUsd, base, bonus, total) => {
		const quote = topupQuoteForUsd(amountUsd);
		expect([quote.baseCredits, quote.bonusCredits, quote.credits]).toEqual([
			base,
			bonus,
			total,
		]);
	});

	// A tier edge must never make one more dollar buy fewer credits.
	it("gives more credits for each added dollar from 1 to 1000 USD", () => {
		for (let amountUsd = 1; amountUsd < 1000; amountUsd++) {
			expect(topupQuoteForUsd(amountUsd + 1).credits).toBeGreaterThan(
				topupQuoteForUsd(amountUsd).credits,
			);
		}
	});

	// A bug must not grant a fraction or a negative amount.
	it.each([
		[0],
		[-1],
		[10.5],
		[Number.NaN],
	])("throws a RangeError for %d USD", (amountUsd) => {
		expect(() => topupQuoteForUsd(amountUsd)).toThrow(RangeError);
	});
});

describe("smallestTopupCovering", () => {
	// The 402 dialog opens on this amount. It must cover a decimal shortfall and stay in 10 to 1000 USD.
	it.each([
		[0, 10],
		[37, 10],
		[100.5, 11],
		[390, 39],
		[391, 40],
		[20000, 1000],
	])("a shortfall of %d credits needs %d USD", (shortfallCredits, expected) => {
		expect(smallestTopupCovering(shortfallCredits)).toBe(expected);
	});
});

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
	])("preferred method %s -> success %s", (preferredPaymentMethod, expected) => {
		const result = createManualSubscriptionRequestBodySchema.safeParse({
			amountUsd: 25,
			fullName: "Amina Example",
			phone: "+213 661 22 33 44",
			country: "DZ",
			preferredPaymentMethod,
		});
		expect(result.success).toBe(expected);
	});
});
