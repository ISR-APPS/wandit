import {
	InternalServerErrorException,
	NotFoundException,
} from "@nestjs/common";
import {
	affiliatePortalCommissionsResponseSchema,
	affiliatePortalMeResponseSchema,
	affiliatePortalOverviewSchema,
	affiliatePortalPayoutsResponseSchema,
	affiliatePortalReferralsResponseSchema,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type {
	AffiliateAdminAffiliateRow,
	AffiliateAdminAttributionRecord,
	AffiliateAdminCommissionRecord,
	AffiliateAdminCoreAggregate,
	AffiliateAdminLinkRecord,
	AffiliateAdminPayoutRecord,
	AffiliateAdminProgramRow,
	AffiliateAdminRepository,
} from "../../infrastructure/persistence/affiliate-admin.repository";
import type { AffiliatePortalRepository } from "../../infrastructure/persistence/affiliate-portal.repository";
import { AffiliatePortalService } from "./affiliate-portal.service";

const PROGRAM_ID = "11111111-1111-4111-8111-111111111111";
const AFFILIATE_ID = "22222222-2222-4222-8222-222222222222";
const LINK_ID = "33333333-3333-4333-8333-333333333333";
const SECOND_LINK_ID = "44444444-4444-4444-8444-444444444444";
const ATTRIBUTION_ID = "55555555-5555-4555-8555-555555555555";
const COMMISSION_ID = "66666666-6666-4666-8666-666666666666";
const PAYOUT_ID = "77777777-7777-4777-8777-777777777777";
const REQUEST_ID = "88888888-8888-4888-8888-888888888888";
const ADJUSTMENT_COMMISSION_ID = "99999999-9999-4999-8999-999999999999";
const USER_ID = "affiliate_user";
const REFERRED_USER_ID = "referred_user";
const REFERRED_NAME = "Grace Customer";
const REFERRED_EMAIL = "grace.customer+portal@example.com";
const CREATED_AT = new Date("2026-08-02T12:00:00.000Z");
const UPDATED_AT = new Date("2026-08-03T12:00:00.000Z");
const SIGNED_UP_AT = new Date("2026-06-04T08:30:00.000Z");
const FIRST_PAID_AT = new Date("2026-06-10T09:00:00.000Z");
const LAST_PAID_AT = new Date("2026-07-10T09:00:00.000Z");
const HOLD_UNTIL = new Date("2026-07-15T00:00:00.000Z");
const PERIOD_START = new Date("2026-06-01T00:00:00.000Z");
const PERIOD_END = new Date("2026-06-30T23:59:59.000Z");
const PAID_AT = new Date("2026-07-05T10:00:00.000Z");

const currencyAggregate = {
	currency: "usd",
	attributedRevenueCents: 50_000,
	pendingCommissionCents: 1_000,
	approvedCommissionCents: 2_000,
	paidCommissionCents: 3_000,
	balanceCents: 3_000,
};

function programRow(
	overrides: Partial<AffiliateAdminProgramRow> = {},
): AffiliateAdminProgramRow {
	return {
		id: PROGRAM_ID,
		name: "Partner program",
		kind: "percentage_recurring",
		commissionRateBps: 2_000,
		fixedAmountCents: null,
		fixedCurrency: null,
		commissionDurationMonths: 12,
		holdDays: 30,
		cookieWindowDays: 60,
		status: "active",
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
		...overrides,
	};
}

function affiliateRow(
	overrides: Partial<AffiliateAdminAffiliateRow> = {},
): AffiliateAdminAffiliateRow {
	return {
		id: AFFILIATE_ID,
		userId: USER_ID,
		name: "Ada Partner",
		email: "ada@example.com",
		company: "Analytical Engines",
		channel: "newsletter",
		country: "DZ",
		payoutMethod: "wise",
		payoutDetails: { account: "admin-only-account" },
		status: "paused",
		notes: "Admin-only partner notes",
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
		...overrides,
	};
}

function affiliateCoreAggregates(): AffiliateAdminCoreAggregate {
	return {
		linkCount: 2,
		activeLinkCount: 2,
		clickCount: 80,
		uniqueVisitorCount: 60,
		attributedUserCount: 12,
		paidCustomerCount: 8,
		paidInvoiceCount: 19,
		lastConversionAt: LAST_PAID_AT,
		currencies: [currencyAggregate],
	};
}

function linkRecord(
	overrides: Partial<AffiliateAdminLinkRecord["link"]> = {},
): AffiliateAdminLinkRecord {
	const link = {
		id: LINK_ID,
		programId: PROGRAM_ID,
		affiliateId: AFFILIATE_ID,
		code: "ada-ref",
		label: "Main campaign",
		landingPath: "/pricing",
		expiresAt: null,
		active: true,
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
		...overrides,
	};

	return {
		link,
		program: {
			id: PROGRAM_ID,
			name: "Partner program",
			kind: "percentage_recurring",
			status: "active",
		},
		aggregates: {
			clickCount: 40,
			uniqueVisitorCount: 30,
			attributedUserCount: 6,
			paidCustomerCount: 4,
			paidInvoiceCount: 9,
			lastConversionAt: LAST_PAID_AT,
			currencies: [currencyAggregate],
		},
	};
}

function attributionRecord(): AffiliateAdminAttributionRecord {
	return {
		attribution: {
			id: ATTRIBUTION_ID,
			userId: REFERRED_USER_ID,
			linkId: LINK_ID,
			affiliateId: AFFILIATE_ID,
			programId: PROGRAM_ID,
			programKind: "percentage_recurring",
			commissionRateBps: 2_000,
			fixedAmountCents: null,
			fixedCurrency: null,
			commissionDurationMonths: 12,
			clickedAt: new Date("2026-06-03T18:00:00.000Z"),
			lockedAt: SIGNED_UP_AT,
			source: "signup_cookie",
			status: "active",
			fraudFlags: [
				{
					code: "self_referral_email",
					detectedAt: SIGNED_UP_AT.toISOString(),
					resolvedAt: null,
					resolvedByUserId: null,
				},
			],
			createdAt: SIGNED_UP_AT,
			updatedAt: UPDATED_AT,
		},
		user: {
			id: REFERRED_USER_ID,
			name: REFERRED_NAME,
			email: REFERRED_EMAIL,
		},
		link: { id: LINK_ID, code: "ada-ref", label: "Main campaign" },
		program: {
			id: PROGRAM_ID,
			name: "Partner program",
			kind: "percentage_recurring",
			status: "active",
		},
		paidInvoiceCount: 3,
		firstPaidAt: FIRST_PAID_AT,
		lastPaidAt: LAST_PAID_AT,
		currencies: [currencyAggregate],
	};
}

function commissionRecord(): AffiliateAdminCommissionRecord {
	return {
		commission: {
			id: COMMISSION_ID,
			attributionId: ATTRIBUTION_ID,
			affiliateId: AFFILIATE_ID,
			entryType: "earning",
			originalCommissionId: null,
			stripeInvoiceId: "stripe_invoice_secret",
			stripeRefundId: "stripe_refund_secret",
			stripeDisputeId: "stripe_dispute_secret",
			stripeChargeId: "stripe_charge_secret",
			currency: "usd",
			baseAmountCents: 5_000,
			rateBps: 2_000,
			amountCents: 1_000,
			status: "approved",
			holdUntil: HOLD_UNTIL,
			payoutId: PAYOUT_ID,
			reversalReason: null,
			createdAt: CREATED_AT,
			updatedAt: UPDATED_AT,
		},
		affiliate: {
			id: AFFILIATE_ID,
			name: "Ada Partner",
			email: "ada@example.com",
		},
		attributedUser: {
			id: REFERRED_USER_ID,
			name: REFERRED_NAME,
			email: REFERRED_EMAIL,
		},
		link: { id: LINK_ID, code: "ada-ref", label: "Main campaign" },
	};
}

function adjustmentCommissionRecord(): AffiliateAdminCommissionRecord {
	const earning = commissionRecord();

	return {
		...earning,
		commission: {
			...earning.commission,
			id: ADJUSTMENT_COMMISSION_ID,
			entryType: "adjustment",
			originalCommissionId: COMMISSION_ID,
			amountCents: -1_000,
			payoutId: null,
			reversalReason: "dispute_won:dp_123",
		},
	};
}

function payoutRecord(): AffiliateAdminPayoutRecord {
	return {
		payout: {
			id: PAYOUT_ID,
			affiliateId: AFFILIATE_ID,
			totalCents: 3_000,
			currency: "usd",
			method: "wise",
			externalRef: "wise-transfer-123",
			requestId: REQUEST_ID,
			status: "paid",
			periodStart: PERIOD_START,
			periodEnd: PERIOD_END,
			paidAt: PAID_AT,
			createdByUserId: "admin_user",
			createdAt: CREATED_AT,
			updatedAt: UPDATED_AT,
		},
		affiliate: {
			id: AFFILIATE_ID,
			name: "Ada Partner",
			email: "ada@example.com",
		},
		entryCount: 3,
	};
}

function setup() {
	const adminRepository = {
		getAffiliateCoreAggregates: vi.fn(),
		listAllLinks: vi.fn(),
		listAttributions: vi.fn(),
		listCommissions: vi.fn(),
		listPayouts: vi.fn(),
	};
	const portalRepository = {
		findAffiliateByUserId: vi.fn().mockResolvedValue(affiliateRow()),
		listProgramsByIds: vi.fn(),
	};
	const service = new AffiliatePortalService(
		adminRepository as unknown as AffiliateAdminRepository,
		portalRepository as unknown as AffiliatePortalRepository,
	);

	return { adminRepository, portalRepository, service };
}

function expectNoReferralLeaks(payload: unknown): void {
	const json = JSON.stringify(payload);

	expect(json).not.toContain(REFERRED_EMAIL);
	expect(json).not.toContain(REFERRED_NAME);
	expect(json).not.toContain(REFERRED_USER_ID);
	expect(json).not.toContain("stripe");
	expect(json).not.toContain("fraudFlags");
}

const protectedPortalReads = [
	{
		method: "overview",
		read: (service: AffiliatePortalService) => service.overview(USER_ID),
	},
	{
		method: "listReferrals",
		read: (service: AffiliatePortalService) =>
			service.listReferrals(USER_ID, { page: 1, pageSize: 20 }),
	},
	{
		method: "listCommissions",
		read: (service: AffiliatePortalService) =>
			service.listCommissions(USER_ID, { page: 1, pageSize: 20 }),
	},
	{
		method: "listPayouts",
		read: (service: AffiliatePortalService) =>
			service.listPayouts(USER_ID, { page: 1, pageSize: 20 }),
	},
];

describe("AffiliatePortalService", () => {
	it("returns a schema-valid null profile for an unknown user", async () => {
		const { adminRepository, portalRepository, service } = setup();
		portalRepository.findAffiliateByUserId.mockResolvedValue(null);

		const result = await service.me(USER_ID);

		expect(result).toEqual({ affiliate: null });
		expect(affiliatePortalMeResponseSchema.parse(result)).toEqual(result);
		expect(portalRepository.findAffiliateByUserId).toHaveBeenCalledWith(
			USER_ID,
		);
		expect(adminRepository.getAffiliateCoreAggregates).not.toHaveBeenCalled();
	});

	it("maps only the portal-safe profile fields", async () => {
		const { service } = setup();

		const result = await service.me(USER_ID);

		expect(result).toEqual({
			affiliate: {
				id: AFFILIATE_ID,
				name: "Ada Partner",
				email: "ada@example.com",
				status: "paused",
				payoutMethod: "wise",
				createdAt: CREATED_AT.toISOString(),
			},
		});
		expect(affiliatePortalMeResponseSchema.parse(result)).toEqual(result);
		expect(JSON.stringify(result)).not.toContain("admin-only");
	});

	it.each(
		protectedPortalReads,
	)("returns 404 before admin reads when $method is requested by a non-affiliate", async ({
		read,
	}) => {
		const { adminRepository, portalRepository, service } = setup();
		portalRepository.findAffiliateByUserId.mockResolvedValue(null);

		await expect(read(service)).rejects.toBeInstanceOf(NotFoundException);
		for (const repositoryRead of Object.values(adminRepository)) {
			expect(repositoryRead).not.toHaveBeenCalled();
		}
	});

	it("returns 404 when overview is requested by a non-affiliate", async () => {
		const { portalRepository, service } = setup();
		portalRepository.findAffiliateByUserId.mockResolvedValue(null);

		const result = service.overview(USER_ID);

		await expect(result).rejects.toBeInstanceOf(NotFoundException);
		await expect(result).rejects.toThrow("Affiliate profile not found");
	});

	it("maps a schema-valid overview with full terms and deduplicated programs", async () => {
		const { adminRepository, portalRepository, service } = setup();
		adminRepository.getAffiliateCoreAggregates.mockResolvedValue(
			affiliateCoreAggregates(),
		);
		adminRepository.listAllLinks.mockResolvedValue([
			linkRecord(),
			linkRecord({
				id: SECOND_LINK_ID,
				code: "ada-second",
				label: "Second campaign",
			}),
		]);
		portalRepository.listProgramsByIds.mockResolvedValue([programRow()]);

		const result = await service.overview(USER_ID);

		expect(affiliatePortalOverviewSchema.parse(result)).toEqual(result);
		expect(result.affiliate).toEqual({
			id: AFFILIATE_ID,
			name: "Ada Partner",
			email: "ada@example.com",
			status: "paused",
			payoutMethod: "wise",
			createdAt: CREATED_AT.toISOString(),
		});
		expect(result.aggregates).toEqual({
			linkCount: 2,
			activeLinkCount: 2,
			clickCount: 80,
			uniqueVisitorCount: 60,
			attributedUserCount: 12,
			paidCustomerCount: 8,
			paidInvoiceCount: 19,
			lastConversionAt: LAST_PAID_AT.toISOString(),
			currencies: [currencyAggregate],
		});
		expect(result.links[0]).toEqual({
			link: {
				id: LINK_ID,
				programId: PROGRAM_ID,
				affiliateId: AFFILIATE_ID,
				code: "ada-ref",
				label: "Main campaign",
				landingPath: "/pricing",
				expiresAt: null,
				active: true,
				status: "active",
				createdAt: CREATED_AT.toISOString(),
				updatedAt: UPDATED_AT.toISOString(),
			},
			program: {
				id: PROGRAM_ID,
				name: "Partner program",
				kind: "percentage_recurring",
				commissionRateBps: 2_000,
				fixedAmountCents: null,
				fixedCurrency: null,
				commissionDurationMonths: 12,
				holdDays: 30,
				cookieWindowDays: 60,
				status: "active",
				createdAt: CREATED_AT.toISOString(),
				updatedAt: UPDATED_AT.toISOString(),
			},
			aggregates: {
				clickCount: 40,
				uniqueVisitorCount: 30,
				attributedUserCount: 6,
				paidCustomerCount: 4,
				paidInvoiceCount: 9,
				lastConversionAt: LAST_PAID_AT.toISOString(),
				currencies: [currencyAggregate],
			},
		});
		expect(result.links).toHaveLength(2);
		expect(portalRepository.listProgramsByIds).toHaveBeenCalledWith([
			PROGRAM_ID,
		]);
		expect(JSON.stringify(result)).not.toContain("admin-only");
		expect(JSON.stringify(result)).not.toContain("healthyTrials");
	});

	it("maps an overview with no links without reading programs", async () => {
		const { adminRepository, portalRepository, service } = setup();
		adminRepository.getAffiliateCoreAggregates.mockResolvedValue({
			...affiliateCoreAggregates(),
			activeLinkCount: 0,
			linkCount: 0,
		});
		adminRepository.listAllLinks.mockResolvedValue([]);

		const result = await service.overview(USER_ID);

		expect(affiliatePortalOverviewSchema.parse(result)).toEqual(result);
		expect(result.links).toEqual([]);
		expect(result.aggregates).toMatchObject({
			activeLinkCount: 0,
			linkCount: 0,
		});
		expect(portalRepository.listProgramsByIds).not.toHaveBeenCalled();
	});

	it("throws an integrity error when a link program is missing", async () => {
		const { adminRepository, portalRepository, service } = setup();
		adminRepository.getAffiliateCoreAggregates.mockResolvedValue(
			affiliateCoreAggregates(),
		);
		adminRepository.listAllLinks.mockResolvedValue([linkRecord()]);
		portalRepository.listProgramsByIds.mockResolvedValue([]);

		await expect(service.overview(USER_ID)).rejects.toBeInstanceOf(
			InternalServerErrorException,
		);
	});

	it("maps referrals without exposing user identity or fraud details", async () => {
		const { adminRepository, service } = setup();
		adminRepository.listAttributions.mockResolvedValue({
			items: [attributionRecord()],
			page: 2,
			pageSize: 5,
			total: 11,
		});

		const result = await service.listReferrals(USER_ID, {
			page: 2,
			pageSize: 5,
			status: "active",
		});

		expect(affiliatePortalReferralsResponseSchema.parse(result)).toEqual(
			result,
		);
		expect(result).toEqual({
			items: [
				{
					id: ATTRIBUTION_ID,
					maskedEmail: "g***@example.com",
					signedUpAt: SIGNED_UP_AT.toISOString(),
					status: "active",
					link: {
						id: LINK_ID,
						code: "ada-ref",
						label: "Main campaign",
					},
					program: {
						id: PROGRAM_ID,
						name: "Partner program",
						kind: "percentage_recurring",
						status: "active",
					},
					programKind: "percentage_recurring",
					commissionRateBps: 2_000,
					fixedAmountCents: null,
					fixedCurrency: null,
					commissionDurationMonths: 12,
					paidInvoiceCount: 3,
					firstPaidAt: FIRST_PAID_AT.toISOString(),
					lastPaidAt: LAST_PAID_AT.toISOString(),
					currencies: [currencyAggregate],
				},
			],
			page: 2,
			pageSize: 5,
			total: 11,
		});
		expect(adminRepository.listAttributions).toHaveBeenCalledWith(
			AFFILIATE_ID,
			{
				page: 2,
				pageSize: 5,
				status: "active",
				fraud: "all",
			},
		);
		expectNoReferralLeaks(result);
	});

	it("maps adjustments and removes Stripe ids from reversal reasons", async () => {
		const { adminRepository, service } = setup();
		adminRepository.listCommissions.mockResolvedValue({
			items: [adjustmentCommissionRecord()],
			page: 1,
			pageSize: 20,
			total: 1,
		});

		const result = await service.listCommissions(USER_ID, {
			page: 1,
			pageSize: 20,
			entryType: "adjustment",
		});

		expect(affiliatePortalCommissionsResponseSchema.parse(result)).toEqual(
			result,
		);
		expect(result.items[0]).toMatchObject({
			id: ADJUSTMENT_COMMISSION_ID,
			entryType: "adjustment",
			amountCents: -1_000,
			reversalReason: "dispute_won",
		});
		expect(JSON.stringify(result)).not.toContain("dp_123");
		expectNoReferralLeaks(result);
	});

	it("maps commissions without exposing Stripe or user identity fields", async () => {
		const { adminRepository, service } = setup();
		adminRepository.listCommissions.mockResolvedValue({
			items: [commissionRecord()],
			page: 4,
			pageSize: 6,
			total: 20,
		});

		const result = await service.listCommissions(USER_ID, {
			page: 4,
			pageSize: 6,
			entryType: "earning",
			status: "approved",
			currency: "usd",
		});

		expect(affiliatePortalCommissionsResponseSchema.parse(result)).toEqual(
			result,
		);
		expect(result).toEqual({
			items: [
				{
					id: COMMISSION_ID,
					entryType: "earning",
					status: "approved",
					currency: "usd",
					baseAmountCents: 5_000,
					rateBps: 2_000,
					amountCents: 1_000,
					holdUntil: HOLD_UNTIL.toISOString(),
					payoutId: PAYOUT_ID,
					reversalReason: null,
					createdAt: CREATED_AT.toISOString(),
					referral: {
						id: ATTRIBUTION_ID,
						maskedEmail: "g***@example.com",
					},
					link: {
						id: LINK_ID,
						code: "ada-ref",
						label: "Main campaign",
					},
				},
			],
			page: 4,
			pageSize: 6,
			total: 20,
		});
		expect(adminRepository.listCommissions).toHaveBeenCalledWith({
			page: 4,
			pageSize: 6,
			affiliateId: AFFILIATE_ID,
			entryType: "earning",
			status: "approved",
			currency: "usd",
			sort: "newest",
		});
		expectNoReferralLeaks(result);
	});

	it("maps payouts without exposing request or creator fields", async () => {
		const { adminRepository, service } = setup();
		adminRepository.listPayouts.mockResolvedValue({
			items: [payoutRecord()],
			page: 1,
			pageSize: 10,
			total: 1,
		});

		const result = await service.listPayouts(USER_ID, {
			page: 1,
			pageSize: 10,
			status: "paid",
		});

		expect(affiliatePortalPayoutsResponseSchema.parse(result)).toEqual(result);
		expect(result).toEqual({
			items: [
				{
					id: PAYOUT_ID,
					totalCents: 3_000,
					currency: "usd",
					method: "wise",
					externalRef: "wise-transfer-123",
					status: "paid",
					periodStart: PERIOD_START.toISOString(),
					periodEnd: PERIOD_END.toISOString(),
					paidAt: PAID_AT.toISOString(),
					entryCount: 3,
					createdAt: CREATED_AT.toISOString(),
				},
			],
			page: 1,
			pageSize: 10,
			total: 1,
		});
		expect(adminRepository.listPayouts).toHaveBeenCalledWith({
			page: 1,
			pageSize: 10,
			affiliateId: AFFILIATE_ID,
			status: "paid",
		});
		const json = JSON.stringify(result);
		expect(json).not.toContain("requestId");
		expect(json).not.toContain(REQUEST_ID);
		expect(json).not.toContain("createdByUserId");
		expect(json).not.toContain("admin_user");
	});
});
