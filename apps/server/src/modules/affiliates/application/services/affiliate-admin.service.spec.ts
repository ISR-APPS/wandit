import { NotFoundException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
	AffiliateAdminAffiliateRecord,
	AffiliateAdminAffiliateRow,
	AffiliateAdminLinkRecord,
	AffiliateAdminPayoutRow,
	AffiliateAdminProgramRecord,
	AffiliateAdminProgramRow,
	AffiliateAdminRepository,
} from "../../infrastructure/persistence/affiliate-admin.repository";
import { AffiliateAdminService } from "./affiliate-admin.service";
import type { AffiliatePayoutService } from "./affiliate-payout.service";
import type { AffiliateSelfReferralService } from "./affiliate-self-referral.service";

const PROGRAM_ID = "11111111-1111-4111-8111-111111111111";
const AFFILIATE_ID = "22222222-2222-4222-8222-222222222222";
const LINK_ID = "33333333-3333-4333-8333-333333333333";
const PAYOUT_ID = "44444444-4444-4444-8444-444444444444";
const REQUEST_ID = "55555555-5555-4555-8555-555555555555";
const NOW = new Date("2026-08-02T12:00:00.000Z");
const affiliateTransaction = {} as never;

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
		createdAt: NOW,
		updatedAt: NOW,
		...overrides,
	};
}

function programRecord(): AffiliateAdminProgramRecord {
	return {
		program: programRow(),
		aggregates: {
			affiliateCount: 2,
			linkCount: 3,
			activeLinkCount: 2,
			attributedUserCount: 4,
			paidCustomerCount: 3,
			paidInvoiceCount: 6,
			currencies: [],
		},
	};
}

function affiliateRow(
	overrides: Partial<AffiliateAdminAffiliateRow> = {},
): AffiliateAdminAffiliateRow {
	return {
		id: AFFILIATE_ID,
		userId: "user_1",
		name: "Ada Partner",
		email: "ada@example.com",
		company: "Analytical Engines",
		channel: "newsletter",
		country: "DZ",
		payoutMethod: "wise",
		payoutDetails: { account: "hidden" },
		status: "active",
		notes: "Priority partner",
		createdAt: NOW,
		updatedAt: NOW,
		...overrides,
	};
}

function affiliateRecord(
	overrides: Partial<AffiliateAdminAffiliateRow> = {},
): AffiliateAdminAffiliateRecord {
	return {
		affiliate: affiliateRow(overrides),
		aggregates: {
			linkCount: 2,
			activeLinkCount: 1,
			clickCount: 30,
			uniqueVisitorCount: 20,
			attributedUserCount: 8,
			paidCustomerCount: 5,
			paidInvoiceCount: 12,
			lastConversionAt: NOW,
			currencies: [],
		},
	};
}

function linkRecord(expiresAt: Date | null = null): AffiliateAdminLinkRecord {
	return {
		link: {
			id: LINK_ID,
			programId: PROGRAM_ID,
			affiliateId: AFFILIATE_ID,
			code: "ada-ref",
			label: "Main",
			landingPath: "/pricing",
			expiresAt,
			active: true,
			createdAt: NOW,
			updatedAt: NOW,
		},
		program: {
			id: PROGRAM_ID,
			name: "Partner program",
			kind: "percentage_recurring",
			status: "active",
		},
		aggregates: {
			clickCount: 3,
			uniqueVisitorCount: 2,
			attributedUserCount: 1,
			paidCustomerCount: 1,
			paidInvoiceCount: 1,
			lastConversionAt: NOW,
			currencies: [],
		},
	};
}

function payoutRow(): AffiliateAdminPayoutRow {
	return {
		id: PAYOUT_ID,
		affiliateId: AFFILIATE_ID,
		totalCents: 12_345,
		currency: "usd",
		method: "wise",
		externalRef: null,
		requestId: REQUEST_ID,
		status: "draft",
		periodStart: new Date("2026-07-01T00:00:00.000Z"),
		periodEnd: NOW,
		paidAt: null,
		createdByUserId: "admin_1",
		createdAt: NOW,
		updatedAt: NOW,
	};
}

function setup() {
	const repository = {
		listPrograms: vi.fn(),
		getProgram: vi.fn(),
		findProgram: vi.fn(),
		createProgram: vi.fn(),
		updateProgram: vi.fn(),
		archiveProgram: vi.fn(),
		listAffiliates: vi.fn(),
		getAffiliate: vi.fn(),
		createAffiliate: vi.fn(),
		updateAffiliate: vi.fn(),
		listLinks: vi.fn(),
		listAllLinks: vi.fn(),
		getLink: vi.fn(),
		createLink: vi.fn(),
		updateLink: vi.fn(),
		deactivateLink: vi.fn(),
		listAttributions: vi.fn(),
		listCommissions: vi.fn(),
		listPayouts: vi.fn(),
		getPayout: vi.fn(),
		listAffiliateCsvRows: vi.fn(),
	};
	const payoutService = {
		build: vi.fn(),
		markPaid: vi.fn(),
		markFailed: vi.fn(),
	};
	const selfReferralService = {
		recheckAffiliate: vi.fn(async () => ({ flagged: 0 })),
		mutateAndRecheckAffiliate: vi.fn(
			async (
				_affiliateId: string,
				operation: (tx: never) => Promise<unknown>,
			) => operation(affiliateTransaction),
		),
	};
	const service = new AffiliateAdminService(
		repository as unknown as AffiliateAdminRepository,
		payoutService as unknown as AffiliatePayoutService,
		selfReferralService as unknown as AffiliateSelfReferralService,
	);

	return { payoutService, repository, selfReferralService, service };
}

describe("AffiliateAdminService", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("keeps affiliate pagination and summary inside the returned data", async () => {
		const { repository, service } = setup();
		repository.listAffiliates.mockResolvedValue({
			page: {
				items: [affiliateRecord()],
				page: 3,
				pageSize: 7,
				total: 18,
			},
			summary: {
				affiliateCount: 18,
				activeAffiliateCount: 14,
				linkCount: 25,
				activeLinkCount: 20,
				clickCount: 300,
				uniqueVisitorCount: 200,
				attributedUserCount: 80,
				paidCustomerCount: 50,
				paidInvoiceCount: 120,
				currencies: [],
			},
		});

		const result = await service.listAffiliates({
			page: 3,
			pageSize: 7,
			sort: "newest",
		});

		expect(result.page).toBe(3);
		expect(result.pageSize).toBe(7);
		expect(result.total).toBe(18);
		expect(result.summary.activeAffiliateCount).toBe(14);
		expect(result.items[0]?.affiliate.createdAt).toBe(NOW.toISOString());
		expect(result.items[0]?.aggregates.lastConversionAt).toBe(
			NOW.toISOString(),
		);
	});

	it("rechecks self-referral flags after create before returning detail", async () => {
		const { repository, selfReferralService, service } = setup();
		repository.createAffiliate.mockResolvedValue(affiliateRow());
		repository.getAffiliate.mockResolvedValue(affiliateRecord());
		repository.listAllLinks.mockResolvedValue([]);

		const result = await service.createAffiliate({
			name: "Ada Partner",
			email: "ada@example.com",
		});

		expect(selfReferralService.recheckAffiliate).toHaveBeenCalledWith(
			AFFILIATE_ID,
		);
		expect(repository.getAffiliate).toHaveBeenCalledAfter(
			selfReferralService.recheckAffiliate,
		);
		expect(result.payoutDetails).toEqual({ account: "hidden" });
	});

	it("does not run a self-referral recheck when an update target is missing", async () => {
		const { repository, selfReferralService, service } = setup();
		repository.updateAffiliate.mockResolvedValue(null);

		await expect(
			service.updateAffiliate(AFFILIATE_ID, { status: "paused" }),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(selfReferralService.recheckAffiliate).not.toHaveBeenCalled();
	});

	it("updates affiliate identity and rechecks self-referral in one locked mutation", async () => {
		const { repository, selfReferralService, service } = setup();
		repository.updateAffiliate.mockResolvedValue(affiliateRow());
		repository.getAffiliate.mockResolvedValue(affiliateRecord());
		repository.listAllLinks.mockResolvedValue([]);

		await service.updateAffiliate(AFFILIATE_ID, { userId: "user_1" });

		expect(selfReferralService.mutateAndRecheckAffiliate).toHaveBeenCalledWith(
			AFFILIATE_ID,
			expect.any(Function),
		);
		expect(repository.updateAffiliate).toHaveBeenCalledWith(
			AFFILIATE_ID,
			{ userId: "user_1" },
			affiliateTransaction,
		);
		expect(selfReferralService.recheckAffiliate).not.toHaveBeenCalled();
	});

	it("archives programs and deactivates links as soft deletes", async () => {
		const { repository, service } = setup();
		repository.archiveProgram.mockResolvedValue(true);
		repository.deactivateLink.mockResolvedValue(true);

		await expect(service.archiveProgram(PROGRAM_ID)).resolves.toEqual({
			deleted: true,
		});
		await expect(
			service.deactivateLink(AFFILIATE_ID, LINK_ID),
		).resolves.toEqual({ deleted: true });
		expect(repository.archiveProgram).toHaveBeenCalledWith(PROGRAM_ID);
		expect(repository.deactivateLink).toHaveBeenCalledWith(
			AFFILIATE_ID,
			LINK_ID,
		);
	});

	it("returns 404 when a soft-delete target does not exist", async () => {
		const { repository, service } = setup();
		repository.archiveProgram.mockResolvedValue(false);
		repository.deactivateLink.mockResolvedValue(false);

		await expect(service.archiveProgram(PROGRAM_ID)).rejects.toBeInstanceOf(
			NotFoundException,
		);
		await expect(
			service.deactivateLink(AFFILIATE_ID, LINK_ID),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("derives expired link status from server time", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const { repository, service } = setup();
		repository.getAffiliate.mockResolvedValue(affiliateRecord());
		repository.listLinks.mockResolvedValue({
			items: [linkRecord(new Date("2026-08-02T11:59:59.000Z"))],
			page: 1,
			pageSize: 20,
			total: 1,
		});

		const result = await service.listLinks(AFFILIATE_ID, {
			page: 1,
			pageSize: 20,
		});

		expect(result.items[0]?.link.status).toBe("expired");
	});

	it("passes the authenticated admin id to the atomic payout builder", async () => {
		const { payoutService, repository, service } = setup();
		payoutService.build.mockResolvedValue(payoutRow());
		repository.getPayout.mockResolvedValue({
			payout: payoutRow(),
			affiliate: {
				id: AFFILIATE_ID,
				name: "Ada Partner",
				email: "ada@example.com",
			},
			entries: [],
		});
		const input = {
			affiliateId: AFFILIATE_ID,
			currency: "usd",
			requestId: REQUEST_ID,
		};

		const result = await service.buildPayout(input, "admin_1");

		expect(payoutService.build).toHaveBeenCalledWith(input, "admin_1");
		expect(result.payout.id).toBe(PAYOUT_ID);
		expect(result.entries).toEqual([]);
	});

	it("exports one safe CSV row per affiliate currency", async () => {
		const { repository, service } = setup();
		repository.listAffiliateCsvRows.mockResolvedValue([
			{
				...affiliateRecord({
					name: '=IMPORTXML("https://evil.invalid")',
					company: 'Acme, "Labs"',
				}),
				aggregates: {
					...affiliateRecord().aggregates,
					currencies: [
						{
							currency: "eur",
							attributedRevenueCents: 1_000,
							pendingCommissionCents: 20,
							approvedCommissionCents: 30,
							paidCommissionCents: 40,
							balanceCents: 50,
						},
						{
							currency: "usd",
							attributedRevenueCents: 2_000,
							pendingCommissionCents: 40,
							approvedCommissionCents: 60,
							paidCommissionCents: 80,
							balanceCents: 100,
						},
					],
				},
			},
		]);

		const download = await service.exportAffiliates({});
		const lines = download.content.trimEnd().split("\r\n");

		expect(download.fileName).toBe("affiliates.csv");
		expect(lines).toHaveLength(3);
		expect(lines[0]?.split(",")).toHaveLength(24);
		expect(lines[0]?.match(/attributed_revenue_cents/g)).toHaveLength(1);
		expect(lines[1]).toContain("'=IMPORTXML");
		expect(lines[1]).toContain('"Acme, ""Labs"""');
		expect(lines[1]).toContain(",eur,");
		expect(lines[2]).toContain(",usd,");
	});

	it("maps program pages without moving pagination to response metadata", async () => {
		const { repository, service } = setup();
		repository.listPrograms.mockResolvedValue({
			items: [programRecord()],
			page: 2,
			pageSize: 5,
			total: 9,
		});

		const result = await service.listPrograms({ page: 2, pageSize: 5 });

		expect(result).toMatchObject({ page: 2, pageSize: 5, total: 9 });
		expect(result.items[0]?.program.commissionRateBps).toBe(2_000);
	});
});
