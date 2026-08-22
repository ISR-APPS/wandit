import {
	type AffiliatePortalCommissionsResponse,
	type AffiliatePortalMeResponse,
	type AffiliatePortalOverview,
	type AffiliatePortalPayoutsResponse,
	type AffiliatePortalReferralsResponse,
	affiliatesRoutes,
	type ListAffiliatePortalCommissionsQuery,
	type ListAffiliatePortalPayoutsQuery,
	type ListAffiliatePortalReferralsQuery,
} from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
	ApiService: {
		get: vi.fn(),
	},
}));

import { ApiService } from "@/lib/api-client";
import {
	affiliatePortalKeys,
	keepPreviousPortalData,
} from "./affiliates.queries";
import {
	getAffiliatePortalMe,
	getAffiliatePortalOverview,
	listAffiliatePortalCommissions,
	listAffiliatePortalPayouts,
	listAffiliatePortalReferrals,
} from "./affiliates.services";

const CREATED_AT = "2026-08-01T10:00:00.000Z";
const UPDATED_AT = "2026-08-02T10:00:00.000Z";
const AFFILIATE_ID = "11111111-1111-4111-8111-111111111111";
const PROGRAM_ID = "22222222-2222-4222-8222-222222222222";
const LINK_ID = "33333333-3333-4333-8333-333333333333";
const REFERRAL_ID = "44444444-4444-4444-8444-444444444444";
const COMMISSION_ID = "55555555-5555-4555-8555-555555555555";
const PAYOUT_ID = "66666666-6666-4666-8666-666666666666";
const USER_ID = "77777777-7777-4777-8777-777777777777";
const OTHER_USER_ID = "88888888-8888-4888-8888-888888888888";

const PROFILE = {
	id: AFFILIATE_ID,
	name: "Nadia Partners",
	email: "nadia@example.com",
	status: "active",
	payoutMethod: "wise",
	createdAt: CREATED_AT,
} as const;

const CURRENCY_AGGREGATE = {
	currency: "usd",
	attributedRevenueCents: 125_000,
	pendingCommissionCents: 5_000,
	approvedCommissionCents: 10_000,
	paidCommissionCents: 10_000,
	balanceCents: 15_000,
} as const;

const ME_RESPONSE: AffiliatePortalMeResponse = { affiliate: PROFILE };

const OVERVIEW_RESPONSE: AffiliatePortalOverview = {
	affiliate: PROFILE,
	aggregates: {
		linkCount: 1,
		activeLinkCount: 1,
		clickCount: 42,
		uniqueVisitorCount: 31,
		attributedUserCount: 8,
		paidCustomerCount: 3,
		paidInvoiceCount: 5,
		lastConversionAt: UPDATED_AT,
		currencies: [CURRENCY_AGGREGATE],
	},
	links: [
		{
			link: {
				id: LINK_ID,
				programId: PROGRAM_ID,
				affiliateId: AFFILIATE_ID,
				code: "partner_123",
				label: "Main link",
				landingPath: "/pricing",
				expiresAt: null,
				active: true,
				status: "active",
				createdAt: CREATED_AT,
				updatedAt: UPDATED_AT,
			},
			program: {
				id: PROGRAM_ID,
				name: "Recurring 20%",
				kind: "percentage_recurring",
				commissionRateBps: 2_000,
				fixedAmountCents: null,
				fixedCurrency: null,
				commissionDurationMonths: 12,
				holdDays: 30,
				cookieWindowDays: 30,
				status: "active",
				createdAt: CREATED_AT,
				updatedAt: UPDATED_AT,
			},
			aggregates: {
				clickCount: 42,
				uniqueVisitorCount: 31,
				attributedUserCount: 8,
				paidCustomerCount: 3,
				paidInvoiceCount: 5,
				lastConversionAt: UPDATED_AT,
				currencies: [CURRENCY_AGGREGATE],
			},
		},
	],
};

const REFERRALS_RESPONSE: AffiliatePortalReferralsResponse = {
	items: [
		{
			id: REFERRAL_ID,
			maskedEmail: "n***@example.com",
			signedUpAt: CREATED_AT,
			status: "active",
			link: { id: LINK_ID, code: "partner_123", label: "Main link" },
			program: {
				id: PROGRAM_ID,
				name: "Recurring 20%",
				kind: "percentage_recurring",
				status: "active",
			},
			programKind: "percentage_recurring",
			commissionRateBps: 2_000,
			fixedAmountCents: null,
			fixedCurrency: null,
			commissionDurationMonths: 12,
			paidInvoiceCount: 5,
			firstPaidAt: CREATED_AT,
			lastPaidAt: UPDATED_AT,
			currencies: [CURRENCY_AGGREGATE],
		},
	],
	page: 1,
	pageSize: 10,
	total: 1,
};

const COMMISSIONS_RESPONSE: AffiliatePortalCommissionsResponse = {
	items: [
		{
			id: COMMISSION_ID,
			entryType: "earning",
			status: "approved",
			currency: "usd",
			baseAmountCents: 50_000,
			rateBps: 2_000,
			amountCents: 10_000,
			holdUntil: UPDATED_AT,
			payoutId: null,
			reversalReason: null,
			createdAt: CREATED_AT,
			referral: {
				id: REFERRAL_ID,
				maskedEmail: "n***@example.com",
			},
			link: { id: LINK_ID, code: "partner_123", label: "Main link" },
		},
	],
	page: 2,
	pageSize: 10,
	total: 11,
};

const PAYOUTS_RESPONSE: AffiliatePortalPayoutsResponse = {
	items: [
		{
			id: PAYOUT_ID,
			totalCents: 10_000,
			currency: "usd",
			method: "wise",
			externalRef: "WISE-123",
			status: "paid",
			periodStart: CREATED_AT,
			periodEnd: UPDATED_AT,
			paidAt: UPDATED_AT,
			entryCount: 1,
			createdAt: CREATED_AT,
		},
	],
	page: 1,
	pageSize: 10,
	total: 1,
};

const REFERRALS_QUERY: ListAffiliatePortalReferralsQuery = {
	page: 1,
	pageSize: 10,
	status: "active",
};
const COMMISSIONS_QUERY: ListAffiliatePortalCommissionsQuery = {
	page: 2,
	pageSize: 10,
	entryType: "earning",
	status: "approved",
	currency: "usd",
};
const PAYOUTS_QUERY: ListAffiliatePortalPayoutsQuery = {
	page: 1,
	pageSize: 10,
	status: "paid",
};

describe("affiliate portal services", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("fetches and parses the linked affiliate profile", async () => {
		vi.mocked(ApiService.get).mockResolvedValueOnce(ME_RESPONSE);

		await expect(getAffiliatePortalMe()).resolves.toEqual(ME_RESPONSE);
		expect(ApiService.get).toHaveBeenCalledWith(affiliatesRoutes.portalMe);
	});

	it("fetches and parses the portal overview", async () => {
		vi.mocked(ApiService.get).mockResolvedValueOnce(OVERVIEW_RESPONSE);

		await expect(getAffiliatePortalOverview()).resolves.toEqual(
			OVERVIEW_RESPONSE,
		);
		expect(ApiService.get).toHaveBeenCalledWith(
			affiliatesRoutes.portalOverview,
		);
	});

	it("fetches and parses a filtered referrals page", async () => {
		vi.mocked(ApiService.get).mockResolvedValueOnce(REFERRALS_RESPONSE);

		await expect(
			listAffiliatePortalReferrals(REFERRALS_QUERY),
		).resolves.toEqual(REFERRALS_RESPONSE);
		expect(ApiService.get).toHaveBeenCalledWith(
			affiliatesRoutes.portalReferrals,
			{ query: REFERRALS_QUERY },
		);
	});

	it("fetches and parses a filtered commissions page", async () => {
		vi.mocked(ApiService.get).mockResolvedValueOnce(COMMISSIONS_RESPONSE);

		await expect(
			listAffiliatePortalCommissions(COMMISSIONS_QUERY),
		).resolves.toEqual(COMMISSIONS_RESPONSE);
		expect(ApiService.get).toHaveBeenCalledWith(
			affiliatesRoutes.portalCommissions,
			{ query: COMMISSIONS_QUERY },
		);
	});

	it("fetches and parses a filtered payouts page", async () => {
		vi.mocked(ApiService.get).mockResolvedValueOnce(PAYOUTS_RESPONSE);

		await expect(listAffiliatePortalPayouts(PAYOUTS_QUERY)).resolves.toEqual(
			PAYOUTS_RESPONSE,
		);
		expect(ApiService.get).toHaveBeenCalledWith(
			affiliatesRoutes.portalPayouts,
			{ query: PAYOUTS_QUERY },
		);
	});

	it.each([
		[
			"profile",
			() => getAffiliatePortalMe(),
			{ affiliate: { ...PROFILE, email: "not-an-email" } },
		],
		[
			"overview",
			() => getAffiliatePortalOverview(),
			{
				...OVERVIEW_RESPONSE,
				aggregates: { ...OVERVIEW_RESPONSE.aggregates, clickCount: -1 },
			},
		],
		[
			"referrals",
			() => listAffiliatePortalReferrals(REFERRALS_QUERY),
			{ ...REFERRALS_RESPONSE, total: "1" },
		],
		[
			"commissions",
			() => listAffiliatePortalCommissions(COMMISSIONS_QUERY),
			{ ...COMMISSIONS_RESPONSE, page: "2" },
		],
		[
			"payouts",
			() => listAffiliatePortalPayouts(PAYOUTS_QUERY),
			{ ...PAYOUTS_RESPONSE, pageSize: "10" },
		],
	])("rejects a malformed %s payload", async (_label, request, payload) => {
		vi.mocked(ApiService.get).mockResolvedValueOnce(payload);

		await expect(request()).rejects.toThrow();
	});
});

describe("affiliatePortalKeys", () => {
	it("scopes every portal resource to the signed-in user", () => {
		expect(affiliatePortalKeys.all).toEqual(["affiliate-portal"]);
		expect(affiliatePortalKeys.me(USER_ID)).toEqual([
			"affiliate-portal",
			USER_ID,
			"me",
		]);
		expect(affiliatePortalKeys.overview(USER_ID)).toEqual([
			"affiliate-portal",
			USER_ID,
			"overview",
		]);
		expect(affiliatePortalKeys.referrals(USER_ID, REFERRALS_QUERY)).toEqual([
			"affiliate-portal",
			USER_ID,
			"referrals",
			REFERRALS_QUERY,
		]);
		expect(affiliatePortalKeys.commissions(USER_ID, COMMISSIONS_QUERY)).toEqual(
			["affiliate-portal", USER_ID, "commissions", COMMISSIONS_QUERY],
		);
		expect(affiliatePortalKeys.payouts(USER_ID, PAYOUTS_QUERY)).toEqual([
			"affiliate-portal",
			USER_ID,
			"payouts",
			PAYOUTS_QUERY,
		]);
	});

	it("reuses placeholder data only within the same user scope", () => {
		const previousQueryKey = affiliatePortalKeys.referrals(
			USER_ID,
			REFERRALS_QUERY,
		);

		expect(
			keepPreviousPortalData(REFERRALS_RESPONSE, previousQueryKey, USER_ID),
		).toBe(REFERRALS_RESPONSE);
		expect(
			keepPreviousPortalData(
				REFERRALS_RESPONSE,
				previousQueryKey,
				OTHER_USER_ID,
			),
		).toBeUndefined();
	});
});
