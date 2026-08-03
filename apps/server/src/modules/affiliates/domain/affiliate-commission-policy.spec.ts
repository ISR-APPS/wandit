import { describe, expect, it } from "vitest";

import {
	addDays,
	addUtcMonths,
	affiliateInvoiceBaseCents,
	attributionEarnsAt,
	COMMISSIONABLE_BILLING_REASONS,
	isCommissionableBillingReason,
	payoutEntryRemainsEligible,
	percentageCommissionCents,
	proportionalClawbackCents,
} from "./affiliate-commission-policy";

describe("affiliate commission policy", () => {
	it("whitelists only the three paid subscription billing reasons", () => {
		expect(COMMISSIONABLE_BILLING_REASONS).toEqual([
			"subscription_create",
			"subscription_cycle",
			"subscription_update",
		]);

		for (const reason of COMMISSIONABLE_BILLING_REASONS) {
			expect(isCommissionableBillingReason(reason)).toBe(true);
		}

		for (const reason of [
			"manual",
			"subscription_threshold",
			"upcoming",
			"",
			null,
			undefined,
		]) {
			expect(isCommissionableBillingReason(reason)).toBe(false);
		}
	});

	it("excludes tax and portions covered by customer-balance credit", () => {
		// $100 subtotal + $20 tax, all paid: commission only the tax-free subtotal.
		expect(
			affiliateInvoiceBaseCents({
				amountPaid: 12_000,
				totalExcludingTax: 10_000,
			}),
		).toBe(10_000);

		// $100 subtotal but only $35 moved after customer-balance credit.
		expect(
			affiliateInvoiceBaseCents({
				amountPaid: 3_500,
				totalExcludingTax: 10_000,
			}),
		).toBe(3_500);

		expect(
			affiliateInvoiceBaseCents({ amountPaid: 3_500, totalExcludingTax: null }),
		).toBe(3_500);
		expect(
			affiliateInvoiceBaseCents({
				amountPaid: 3_500,
				totalExcludingTax: undefined,
			}),
		).toBe(3_500);
	});

	it("preserves zero or negative bases for the caller to mark ineligible", () => {
		expect(
			affiliateInvoiceBaseCents({ amountPaid: 0, totalExcludingTax: 0 }),
		).toBe(0);
		expect(
			affiliateInvoiceBaseCents({ amountPaid: 0, totalExcludingTax: -50 }),
		).toBe(-50);
	});

	it("rejects non-integer Stripe money fields", () => {
		expect(() =>
			affiliateInvoiceBaseCents({
				amountPaid: 1.5,
				totalExcludingTax: 1,
			}),
		).toThrow("Stripe invoice amount_paid must be a safe integer");
		expect(() =>
			affiliateInvoiceBaseCents({
				amountPaid: 100,
				totalExcludingTax: Number.MAX_SAFE_INTEGER + 1,
			}),
		).toThrow(
			"Stripe invoice total_excluding_tax must be a safe integer when present",
		);
	});

	it("rounds percentage commissions to the nearest cent", () => {
		expect(percentageCommissionCents(10_000, 2_000)).toBe(2_000);
		expect(percentageCommissionCents(1_005, 1_500)).toBe(151);
		expect(percentageCommissionCents(1_000, 0)).toBe(0);
		expect(() => percentageCommissionCents(1_000, 10_001)).toThrow(
			"Invalid percentage commission inputs",
		);
	});

	it("prorates clawbacks exactly when the intermediate product exceeds safe integers", () => {
		expect(
			proportionalClawbackCents({
				adverseAmountCents: 1_500_000_000,
				chargeAmountCents: 2_000_000_000,
				earningAmountCents: 2_000_000_000,
			}),
		).toBe(1_500_000_000);
		expect(
			proportionalClawbackCents({
				adverseAmountCents: 1,
				chargeAmountCents: 3,
				earningAmountCents: 2,
			}),
		).toBe(1);
		expect(() =>
			proportionalClawbackCents({
				adverseAmountCents: 1,
				chargeAmountCents: 0,
				earningAmountCents: 1,
			}),
		).toThrow("Invalid affiliate clawback inputs");
	});

	it("uses the click lower bound, exclusive duration boundary, and lifetime terms", () => {
		const clickedAt = new Date("2026-01-30T12:30:00.000Z");
		const lockedAt = new Date("2026-01-31T12:30:00.000Z");
		const expiry = new Date("2026-02-28T12:30:00.000Z");

		expect(addUtcMonths(lockedAt, 1)).toEqual(expiry);
		expect(
			attributionEarnsAt(
				clickedAt,
				lockedAt,
				1,
				new Date("2026-02-28T12:29:59.999Z"),
			),
		).toBe(true);
		expect(attributionEarnsAt(clickedAt, lockedAt, 1, expiry)).toBe(false);
		expect(attributionEarnsAt(clickedAt, lockedAt, 1, clickedAt)).toBe(true);
		expect(
			attributionEarnsAt(
				clickedAt,
				lockedAt,
				null,
				new Date("2036-01-31T12:30:00.000Z"),
			),
		).toBe(true);
		expect(
			attributionEarnsAt(
				clickedAt,
				lockedAt,
				null,
				new Date("2026-01-30T12:29:59.999Z"),
			),
		).toBe(false);
	});

	it("adds hold days as exact 24-hour UTC intervals", () => {
		const paidAt = new Date("2026-03-28T23:30:00.000Z");

		expect(addDays(paidAt, 30)).toEqual(new Date("2026-04-27T23:30:00.000Z"));
		expect(() => addDays(paidAt, -1)).toThrow(
			"Affiliate hold days must be a non-negative integer",
		);
	});

	it("only carries negative adjustments after their original can be or was paid", () => {
		const base = {
			amountCents: -500,
			attributionActive: true,
			candidateProcessed: true,
			commissionStatus: "approved" as const,
			originalPayoutId: null,
			originalStatus: "pending" as const,
			payoutId: "payout_1",
			unresolvedFraud: false,
		};

		expect(payoutEntryRemainsEligible(base)).toBe(false);
		expect(
			payoutEntryRemainsEligible({
				...base,
				amountCents: 500,
				originalStatus: null,
			}),
		).toBe(true);
		expect(
			payoutEntryRemainsEligible({
				...base,
				amountCents: 500,
				candidateProcessed: false,
				originalStatus: null,
			}),
		).toBe(false);
		expect(
			payoutEntryRemainsEligible({
				...base,
				originalPayoutId: "payout_1",
				originalStatus: "approved",
			}),
		).toBe(true);
		expect(
			payoutEntryRemainsEligible({
				...base,
				candidateProcessed: false,
				originalPayoutId: "payout_1",
				originalStatus: "approved",
			}),
		).toBe(false);
		expect(
			payoutEntryRemainsEligible({
				...base,
				attributionActive: false,
				originalStatus: "paid",
				unresolvedFraud: true,
			}),
		).toBe(true);
		expect(
			payoutEntryRemainsEligible({
				...base,
				attributionActive: false,
				originalPayoutId: "payout_1",
				originalStatus: "approved",
			}),
		).toBe(false);
	});
});
