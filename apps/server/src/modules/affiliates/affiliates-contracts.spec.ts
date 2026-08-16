import {
	AFFILIATE_ATTRIBUTION_COOKIE_NAME,
	AFFILIATE_SIGNUP_TOKEN_FIELD,
	affiliateClickBodySchema,
	affiliateCommissionSchema,
	affiliateFraudFlagSchema,
	affiliateLinksResponseSchema,
	affiliatesResponseSchema,
	affiliatesRoutes,
	apiSuccessResponseSchema,
	buildAffiliatePayoutInputSchema,
	createAffiliateInputSchema,
	createAffiliateLinkInputSchema,
	createAffiliateProgramInputSchema,
	markAffiliatePayoutFailedInputSchema,
	markAffiliatePayoutPaidInputSchema,
	updateAffiliateProgramInputSchema,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

const affiliateId = "11111111-1111-4111-8111-111111111111";
const programId = "22222222-2222-4222-8222-222222222222";
const linkId = "33333333-3333-4333-8333-333333333333";
const attributionId = "44444444-4444-4444-8444-444444444444";
const commissionId = "55555555-5555-4555-8555-555555555555";
const payoutId = "66666666-6666-4666-8666-666666666666";
const requestId = "77777777-7777-4777-8777-777777777777";
const now = "2026-08-02T12:00:00.000Z";

const currencyAggregate = {
	currency: "usd",
	attributedRevenueCents: 10_000,
	pendingCommissionCents: 500,
	approvedCommissionCents: 1_000,
	paidCommissionCents: 2_000,
	balanceCents: 1_500,
};

describe("affiliate contracts", () => {
	it("locks the referral cookie and Better Auth fallback field names", () => {
		expect(AFFILIATE_ATTRIBUTION_COOKIE_NAME).toBe(
			"wandit_affiliate_attribution",
		);
		expect(AFFILIATE_SIGNUP_TOKEN_FIELD).toBe("affiliateToken");
	});

	it("validates the public click payload without accepting extra input", () => {
		expect(
			affiliateClickBodySchema.safeParse({
				code: "partner_2026",
				landingUrl: "https://wandit.ai/start?ref=partner_2026",
			}).success,
		).toBe(true);

		expect(
			affiliateClickBodySchema.safeParse({
				code: "partner_2026",
				landingUrl: "not a URL",
			}).success,
		).toBe(false);
		expect(
			affiliateClickBodySchema.safeParse({
				code: "partner_2026",
				landingUrl: "https://wandit.ai/start",
				clickedAt: now,
			}).success,
		).toBe(false);
	});

	it("enforces discriminated program terms and bounded settings", () => {
		expect(
			createAffiliateProgramInputSchema.safeParse({
				name: "Recurring partners",
				kind: "percentage_recurring",
				commissionRateBps: 1_500,
				commissionDurationMonths: 12,
				holdDays: 30,
				cookieWindowDays: 60,
			}).success,
		).toBe(true);
		expect(
			createAffiliateProgramInputSchema.safeParse({
				name: "One-time partners",
				kind: "fixed_one_time",
				fixedAmountCents: 2_500,
				fixedCurrency: "usd",
			}).success,
		).toBe(true);

		// Fixed commissions cannot be valued without a currency.
		expect(
			createAffiliateProgramInputSchema.safeParse({
				name: "Incomplete fixed program",
				kind: "fixed_one_time",
				fixedAmountCents: 2_500,
			}).success,
		).toBe(false);
		// Terms from the other kind are rejected rather than silently stripped.
		expect(
			createAffiliateProgramInputSchema.safeParse({
				name: "Mixed terms",
				kind: "percentage_recurring",
				commissionRateBps: 1_500,
				fixedAmountCents: 2_500,
			}).success,
		).toBe(false);
		expect(
			createAffiliateProgramInputSchema.safeParse({
				name: "Out-of-range rate",
				kind: "percentage_recurring",
				commissionRateBps: 10_001,
			}).success,
		).toBe(false);
		expect(
			createAffiliateProgramInputSchema.safeParse({
				name: "Invalid cookie window",
				kind: "percentage_recurring",
				commissionRateBps: 1_500,
				cookieWindowDays: 0,
			}).success,
		).toBe(false);
	});

	it("requires complete terms when a program kind or terms change", () => {
		expect(updateAffiliateProgramInputSchema.safeParse({}).success).toBe(false);
		expect(
			updateAffiliateProgramInputSchema.safeParse({
				commissionRateBps: 2_000,
			}).success,
		).toBe(false);
		expect(
			updateAffiliateProgramInputSchema.safeParse({
				kind: "percentage_recurring",
				commissionRateBps: 2_000,
			}).success,
		).toBe(true);
	});

	it("keeps affiliate and link writes faithful to the database model", () => {
		expect(
			createAffiliateInputSchema.safeParse({
				name: "Nadia Benamar",
				email: "nadia@example.com",
				channel: "creator",
				country: "DZ",
				payoutMethod: "wise",
			}).success,
		).toBe(true);
		expect(
			createAffiliateInputSchema.safeParse({
				name: "Pending mock profile",
				email: "mock@example.com",
				status: "pending",
			}).success,
		).toBe(false);
		expect(
			createAffiliateInputSchema.safeParse({
				name: "Synthetic mock profile",
				email: "mock@example.com",
				defaultCommissionRatePercent: 15,
			}).success,
		).toBe(false);

		expect(
			createAffiliateLinkInputSchema.safeParse({
				programId,
				code: "nadia_2026",
				label: "Newsletter",
				landingPath: "/start",
				expiresAt: null,
			}).success,
		).toBe(true);
		expect(
			createAffiliateLinkInputSchema.safeParse({
				programId,
				code: "nadia_2026",
				landingPath: "/start",
				commissionRatePercent: 15,
				attributionWindowDays: 30,
			}).success,
		).toBe(false);
	});

	it("uses the canonical structured self-referral flags", () => {
		expect(
			affiliateFraudFlagSchema.safeParse({
				code: "self_referral_email",
				detectedAt: now,
				resolvedAt: null,
				resolvedByUserId: null,
			}).success,
		).toBe(true);
		expect(
			affiliateFraudFlagSchema.safeParse({
				code: "some_unstructured_flag",
				detectedAt: now,
				resolvedAt: null,
				resolvedByUserId: null,
			}).success,
		).toBe(false);
	});

	it("requires linked adjustments and positive earnings", () => {
		const common = {
			id: commissionId,
			attributionId,
			affiliateId,
			stripeInvoiceId: "in_1",
			stripeRefundId: null,
			stripeDisputeId: null,
			stripeChargeId: "ch_1",
			currency: "usd",
			baseAmountCents: 2_500,
			rateBps: 1_500,
			status: "pending",
			holdUntil: now,
			payoutId: null,
			reversalReason: null,
			createdAt: now,
			updatedAt: now,
		} as const;

		expect(
			affiliateCommissionSchema.safeParse({
				...common,
				entryType: "earning",
				originalCommissionId: null,
				amountCents: 375,
			}).success,
		).toBe(true);
		expect(
			affiliateCommissionSchema.safeParse({
				...common,
				entryType: "earning",
				originalCommissionId: null,
				amountCents: 0,
			}).success,
		).toBe(false);
		expect(
			affiliateCommissionSchema.safeParse({
				...common,
				entryType: "adjustment",
				originalCommissionId: commissionId,
				amountCents: -100,
			}).success,
		).toBe(true);
		expect(
			affiliateCommissionSchema.safeParse({
				...common,
				entryType: "adjustment",
				originalCommissionId: null,
				amountCents: -100,
			}).success,
		).toBe(false);
	});

	it("keeps list pagination and summary inside the envelope data", () => {
		const response = {
			items: [
				{
					affiliate: {
						id: affiliateId,
						userId: null,
						name: "Nadia Benamar",
						email: "nadia@example.com",
						company: null,
						channel: "creator",
						country: "DZ",
						payoutMethod: "wise",
						status: "active",
						createdAt: now,
						updatedAt: now,
					},
					aggregates: {
						linkCount: 1,
						activeLinkCount: 1,
						clickCount: 20,
						uniqueVisitorCount: 15,
						attributedUserCount: 4,
						paidCustomerCount: 2,
						healthyTrials: 1,
						churnedCustomers: 1,
						referredMrrCents: 2_500,
						referredLtvCents: null,
						paidInvoiceCount: 3,
						lastConversionAt: now,
						currencies: [currencyAggregate],
					},
				},
			],
			page: 2,
			pageSize: 20,
			total: 41,
			summary: {
				affiliateCount: 41,
				activeAffiliateCount: 32,
				linkCount: 50,
				activeLinkCount: 40,
				clickCount: 500,
				uniqueVisitorCount: 400,
				attributedUserCount: 100,
				paidCustomerCount: 60,
				paidInvoiceCount: 80,
				currencies: [currencyAggregate],
			},
		};

		expect(affiliatesResponseSchema.safeParse(response).success).toBe(true);
		expect(
			apiSuccessResponseSchema(affiliatesResponseSchema).safeParse({
				data: response,
				meta: { requestId: "request_1", timestamp: now },
			}).success,
		).toBe(true);
		expect(response.page).toBe(2);
		expect(response.summary.affiliateCount).toBe(41);

		// Other affiliate lists use the same inner pagination shape.
		expect(
			affiliateLinksResponseSchema.safeParse({
				items: [],
				page: 1,
				pageSize: 20,
				total: 0,
			}).success,
		).toBe(true);
	});

	it("keeps payout method server-derived and validates terminal actions", () => {
		expect(
			buildAffiliatePayoutInputSchema.safeParse({
				affiliateId,
				currency: "usd",
				requestId,
			}).success,
		).toBe(true);
		expect(
			buildAffiliatePayoutInputSchema.safeParse({
				affiliateId,
				currency: "usd",
				requestId,
				method: "wise",
			}).success,
		).toBe(false);
		expect(
			markAffiliatePayoutPaidInputSchema.safeParse({
				externalRef: "wise-transfer-123",
			}).success,
		).toBe(true);
		expect(markAffiliatePayoutFailedInputSchema.safeParse({}).success).toBe(
			true,
		);
		expect(
			markAffiliatePayoutFailedInputSchema.safeParse({
				reason: "bank rejected transfer",
			}).success,
		).toBe(true);
	});

	it("locks the nested admin route family", () => {
		expect(affiliatesRoutes.click).toBe("/api/v1/affiliates/click");
		expect(affiliatesRoutes.adminAffiliates).toBe("/api/v1/admin/affiliates");
		expect(affiliatesRoutes.adminAffiliate(affiliateId)).toBe(
			`/api/v1/admin/affiliates/${affiliateId}`,
		);
		expect(affiliatesRoutes.adminAffiliateLinks(affiliateId)).toBe(
			`/api/v1/admin/affiliates/${affiliateId}/links`,
		);
		expect(affiliatesRoutes.adminAffiliateLink(affiliateId, linkId)).toBe(
			`/api/v1/admin/affiliates/${affiliateId}/links/${linkId}`,
		);
		expect(affiliatesRoutes.adminAffiliateAttributions(affiliateId)).toBe(
			`/api/v1/admin/affiliates/${affiliateId}/attributions`,
		);
		expect(affiliatesRoutes.adminPrograms).toBe(
			"/api/v1/admin/affiliates/programs",
		);
		expect(affiliatesRoutes.adminProgram(programId)).toBe(
			`/api/v1/admin/affiliates/programs/${programId}`,
		);
		expect(affiliatesRoutes.adminCommissions).toBe(
			"/api/v1/admin/affiliates/commissions",
		);
		expect(affiliatesRoutes.adminPayouts).toBe(
			"/api/v1/admin/affiliates/payouts",
		);
		expect(affiliatesRoutes.adminPayout(payoutId)).toBe(
			`/api/v1/admin/affiliates/payouts/${payoutId}`,
		);
		expect(affiliatesRoutes.adminPayoutMarkPaid(payoutId)).toBe(
			`/api/v1/admin/affiliates/payouts/${payoutId}/mark-paid`,
		);
		expect(affiliatesRoutes.adminPayoutMarkFailed(payoutId)).toBe(
			`/api/v1/admin/affiliates/payouts/${payoutId}/mark-failed`,
		);
		expect(affiliatesRoutes.adminExport).toBe(
			"/api/v1/admin/affiliates/export",
		);
	});
});
