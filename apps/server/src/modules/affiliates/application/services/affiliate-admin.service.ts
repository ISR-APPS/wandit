import {
	ConflictException,
	Inject,
	Injectable,
	InternalServerErrorException,
	NotFoundException,
} from "@nestjs/common";
import type {
	Affiliate,
	AffiliateAttributedUser,
	AffiliateAttributionsResponse,
	AffiliateCommissionLedgerEntry,
	AffiliateCommissionsResponse,
	AffiliateCsvExportQuery,
	AffiliateDetail,
	AffiliateLinkListItem,
	AffiliateLinksResponse,
	AffiliatePayout,
	AffiliatePayoutDetail,
	AffiliatePayoutListItem,
	AffiliatePayoutsResponse,
	AffiliateProgram,
	AffiliateProgramDetail,
	AffiliateProgramListItem,
	AffiliateProgramsResponse,
	AffiliatesResponse,
	BuildAffiliatePayoutInput,
	CreateAffiliateInput,
	CreateAffiliateLinkInput,
	CreateAffiliateProgramInput,
	DeleteAffiliateResourceResponse,
	ListAffiliateAttributionsQuery,
	ListAffiliateCommissionsQuery,
	ListAffiliateLinksQuery,
	ListAffiliatePayoutsQuery,
	ListAffiliateProgramsQuery,
	ListAffiliatesQuery,
	UpdateAffiliateInput,
	UpdateAffiliateLinkInput,
	UpdateAffiliateProgramInput,
} from "@wandit/contracts";

import { parseAffiliateFraudFlags } from "../../domain/affiliate-fraud";
import type {
	AffiliateAdminAffiliateRecord,
	AffiliateAdminAffiliateRow,
	AffiliateAdminAttributionRecord,
	AffiliateAdminCommissionRecord,
	AffiliateAdminLinkRecord,
	AffiliateAdminPayoutRecord,
	AffiliateAdminPayoutRow,
	AffiliateAdminProgramRecord,
	AffiliateAdminProgramRow,
} from "../../infrastructure/persistence/affiliate-admin.repository";
import { AffiliateAdminRepository } from "../../infrastructure/persistence/affiliate-admin.repository";
import { AffiliatePayoutService } from "./affiliate-payout.service";
import { AffiliateSelfReferralService } from "./affiliate-self-referral.service";

export type AffiliateCsvDownload = {
	fileName: string;
	content: string;
};

@Injectable()
export class AffiliateAdminService {
	constructor(
		@Inject(AffiliateAdminRepository)
		private readonly repository: AffiliateAdminRepository,
		@Inject(AffiliatePayoutService)
		private readonly payoutService: AffiliatePayoutService,
		@Inject(AffiliateSelfReferralService)
		private readonly selfReferralService: AffiliateSelfReferralService,
	) {}

	async listPrograms(
		query: ListAffiliateProgramsQuery,
	): Promise<AffiliateProgramsResponse> {
		const page = await this.repository.listPrograms(query);

		return {
			items: page.items.map(mapProgramRecord),
			page: page.page,
			pageSize: page.pageSize,
			total: page.total,
		};
	}

	async getProgram(programId: string): Promise<AffiliateProgramDetail> {
		const row = await this.repository.getProgram(programId);

		if (!row) {
			throw new NotFoundException("Affiliate program not found");
		}

		return mapProgramRecord(row);
	}

	async createProgram(
		input: CreateAffiliateProgramInput,
	): Promise<AffiliateProgramDetail> {
		const created = await this.repository.createProgram(input);

		return this.getProgram(created.id);
	}

	async updateProgram(
		programId: string,
		input: UpdateAffiliateProgramInput,
	): Promise<AffiliateProgramDetail> {
		const updated = await this.repository.updateProgram(programId, input);

		if (!updated) {
			throw new NotFoundException("Affiliate program not found");
		}

		return this.getProgram(updated.id);
	}

	async archiveProgram(
		programId: string,
	): Promise<DeleteAffiliateResourceResponse> {
		if (!(await this.repository.archiveProgram(programId))) {
			throw new NotFoundException("Affiliate program not found");
		}

		return { deleted: true };
	}

	async listAffiliates(
		query: ListAffiliatesQuery,
	): Promise<AffiliatesResponse> {
		const result = await this.repository.listAffiliates(query);

		return {
			items: result.page.items.map(mapAffiliateRecord),
			page: result.page.page,
			pageSize: result.page.pageSize,
			total: result.page.total,
			summary: result.summary,
		};
	}

	async getAffiliate(affiliateId: string): Promise<AffiliateDetail> {
		const row = await this.repository.getAffiliate(affiliateId);

		if (!row) {
			throw new NotFoundException("Affiliate not found");
		}

		const links = await this.repository.listAllLinks(affiliateId);

		return {
			...mapAffiliateRecord(row),
			payoutDetails: recordOrNull(row.affiliate.payoutDetails),
			notes: row.affiliate.notes,
			links: links.map(mapLinkRecord),
		};
	}

	async createAffiliate(input: CreateAffiliateInput): Promise<AffiliateDetail> {
		const created = await this.uniqueWrite(
			() => this.repository.createAffiliate(input),
			"An affiliate is already linked to this user",
		);

		await this.selfReferralService.recheckAffiliate(created.id);

		return this.getAffiliate(created.id);
	}

	async updateAffiliate(
		affiliateId: string,
		input: UpdateAffiliateInput,
	): Promise<AffiliateDetail> {
		const updated = await this.uniqueWrite(
			() =>
				this.selfReferralService.mutateAndRecheckAffiliate(affiliateId, (tx) =>
					this.repository.updateAffiliate(affiliateId, input, tx),
				),
			"An affiliate is already linked to this user",
		);

		if (!updated) {
			throw new NotFoundException("Affiliate not found");
		}

		return this.getAffiliate(updated.id);
	}

	async listLinks(
		affiliateId: string,
		query: ListAffiliateLinksQuery,
	): Promise<AffiliateLinksResponse> {
		await this.ensureAffiliateExists(affiliateId);
		const page = await this.repository.listLinks(affiliateId, query);

		return {
			items: page.items.map(mapLinkRecord),
			page: page.page,
			pageSize: page.pageSize,
			total: page.total,
		};
	}

	async createLink(
		affiliateId: string,
		input: CreateAffiliateLinkInput,
	): Promise<AffiliateLinkListItem> {
		await Promise.all([
			this.ensureAffiliateExists(affiliateId),
			this.ensureProgramExists(input.programId),
		]);
		const created = await this.uniqueWrite(
			() => this.repository.createLink(affiliateId, input),
			"Affiliate link code is already in use",
		);

		return this.requireLink(affiliateId, created.id);
	}

	async updateLink(
		affiliateId: string,
		linkId: string,
		input: UpdateAffiliateLinkInput,
	): Promise<AffiliateLinkListItem> {
		if (input.programId) {
			await this.ensureProgramExists(input.programId);
		}

		const updated = await this.uniqueWrite(
			() => this.repository.updateLink(affiliateId, linkId, input),
			"Affiliate link code is already in use",
		);

		if (!updated) {
			throw new NotFoundException("Affiliate link not found");
		}

		return this.requireLink(affiliateId, updated.id);
	}

	async deactivateLink(
		affiliateId: string,
		linkId: string,
	): Promise<DeleteAffiliateResourceResponse> {
		if (!(await this.repository.deactivateLink(affiliateId, linkId))) {
			throw new NotFoundException("Affiliate link not found");
		}

		return { deleted: true };
	}

	async listAttributions(
		affiliateId: string,
		query: ListAffiliateAttributionsQuery,
	): Promise<AffiliateAttributionsResponse> {
		await this.ensureAffiliateExists(affiliateId);
		const page = await this.repository.listAttributions(affiliateId, query);

		return {
			items: page.items.map(mapAttributionRecord),
			page: page.page,
			pageSize: page.pageSize,
			total: page.total,
		};
	}

	async listCommissions(
		query: ListAffiliateCommissionsQuery,
	): Promise<AffiliateCommissionsResponse> {
		const page = await this.repository.listCommissions(query);

		return {
			items: page.items.map(mapCommissionRecord),
			page: page.page,
			pageSize: page.pageSize,
			total: page.total,
		};
	}

	async listPayouts(
		query: ListAffiliatePayoutsQuery,
	): Promise<AffiliatePayoutsResponse> {
		const page = await this.repository.listPayouts(query);

		return {
			items: page.items.map(mapPayoutRecord),
			page: page.page,
			pageSize: page.pageSize,
			total: page.total,
		};
	}

	async getPayout(payoutId: string): Promise<AffiliatePayoutDetail> {
		const row = await this.repository.getPayout(payoutId);

		if (!row) {
			throw new NotFoundException("Affiliate payout not found");
		}

		return {
			payout: mapPayout(row.payout),
			affiliate: row.affiliate,
			entries: row.entries.map(mapCommissionRecord),
		};
	}

	async buildPayout(
		input: BuildAffiliatePayoutInput,
		createdByUserId: string,
	): Promise<AffiliatePayoutDetail> {
		const payout = await this.payoutService.build(input, createdByUserId);

		return this.getPayout(payout.id);
	}

	async markPayoutPaid(
		payoutId: string,
		externalRef: string,
	): Promise<AffiliatePayoutDetail> {
		const payout = await this.payoutService.markPaid(payoutId, externalRef);

		return this.getPayout(payout.id);
	}

	async markPayoutFailed(
		payoutId: string,
		reason?: string,
	): Promise<AffiliatePayoutDetail> {
		const payout = await this.payoutService.markFailed(payoutId, reason);

		return this.getPayout(payout.id);
	}

	async exportAffiliates(
		query: AffiliateCsvExportQuery,
	): Promise<AffiliateCsvDownload> {
		const rows = await this.repository.listAffiliateCsvRows(query);
		const header = [
			"affiliate_id",
			"user_id",
			"name",
			"email",
			"company",
			"channel",
			"country",
			"payout_method",
			"status",
			"created_at",
			"link_count",
			"active_link_count",
			"click_count",
			"unique_visitor_count",
			"attributed_user_count",
			"paid_customer_count",
			"healthy_trials",
			"churned_customers",
			"referred_mrr_cents",
			"referred_ltv_cents",
			"paid_invoice_count",
			"last_conversion_at",
			"currency",
			"attributed_revenue_cents",
			"pending_commission_cents",
			"approved_commission_cents",
			"paid_commission_cents",
			"balance_cents",
		];
		const body = rows.flatMap((row) => {
			const currencies =
				row.aggregates.currencies.length > 0
					? row.aggregates.currencies
					: [null];

			return currencies.map((currency) =>
				[
					row.affiliate.id,
					row.affiliate.userId,
					row.affiliate.name,
					row.affiliate.email,
					row.affiliate.company,
					row.affiliate.channel,
					row.affiliate.country,
					row.affiliate.payoutMethod,
					row.affiliate.status,
					row.affiliate.createdAt.toISOString(),
					row.aggregates.linkCount,
					row.aggregates.activeLinkCount,
					row.aggregates.clickCount,
					row.aggregates.uniqueVisitorCount,
					row.aggregates.attributedUserCount,
					row.aggregates.paidCustomerCount,
					row.aggregates.healthyTrials,
					row.aggregates.churnedCustomers,
					row.aggregates.referredMrrCents,
					row.aggregates.referredLtvCents,
					row.aggregates.paidInvoiceCount,
					row.aggregates.lastConversionAt?.toISOString() ?? null,
					currency?.currency ?? null,
					currency?.attributedRevenueCents ?? null,
					currency?.pendingCommissionCents ?? null,
					currency?.approvedCommissionCents ?? null,
					currency?.paidCommissionCents ?? null,
					currency?.balanceCents ?? null,
				]
					.map(csvCell)
					.join(","),
			);
		});

		return {
			fileName: "affiliates.csv",
			content: `${[header.join(","), ...body].join("\r\n")}\r\n`,
		};
	}

	private async ensureAffiliateExists(affiliateId: string): Promise<void> {
		if (!(await this.repository.getAffiliate(affiliateId))) {
			throw new NotFoundException("Affiliate not found");
		}
	}

	private async ensureProgramExists(programId: string): Promise<void> {
		if (!(await this.repository.findProgram(programId))) {
			throw new NotFoundException("Affiliate program not found");
		}
	}

	private async requireLink(
		affiliateId: string,
		linkId: string,
	): Promise<AffiliateLinkListItem> {
		const row = await this.repository.getLink(affiliateId, linkId);

		if (!row) {
			throw new InternalServerErrorException(
				"Affiliate link could not be read after it was written",
			);
		}

		return mapLinkRecord(row);
	}

	private async uniqueWrite<T>(
		operation: () => Promise<T>,
		message: string,
	): Promise<T> {
		try {
			return await operation();
		} catch (error) {
			if (
				error !== null &&
				typeof error === "object" &&
				"code" in error &&
				(error as { code?: unknown }).code === "23505"
			) {
				throw new ConflictException(message);
			}

			throw error;
		}
	}
}

function mapProgramRecord(
	record: AffiliateAdminProgramRecord,
): AffiliateProgramListItem {
	return {
		program: mapProgram(record.program),
		aggregates: record.aggregates,
	};
}

function mapProgram(row: AffiliateAdminProgramRow): AffiliateProgram {
	const common = {
		id: row.id,
		name: row.name,
		commissionDurationMonths: row.commissionDurationMonths,
		holdDays: row.holdDays,
		cookieWindowDays: row.cookieWindowDays,
		status: row.status,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};

	if (row.kind === "percentage_recurring") {
		return {
			...common,
			kind: row.kind,
			commissionRateBps: requireNumber(
				row.commissionRateBps,
				"percentage affiliate program commissionRateBps",
			),
			fixedAmountCents: null,
			fixedCurrency: null,
		};
	}

	return {
		...common,
		kind: row.kind,
		commissionRateBps: null,
		fixedAmountCents: requireNumber(
			row.fixedAmountCents,
			"fixed affiliate program fixedAmountCents",
		),
		fixedCurrency: requireString(
			row.fixedCurrency,
			"fixed affiliate program fixedCurrency",
		),
	};
}

function mapAffiliateRecord(
	record: AffiliateAdminAffiliateRecord,
): AffiliatesResponse["items"][number] {
	return {
		affiliate: mapAffiliate(record.affiliate),
		aggregates: {
			...record.aggregates,
			lastConversionAt:
				record.aggregates.lastConversionAt?.toISOString() ?? null,
		},
	};
}

function mapAffiliate(row: AffiliateAdminAffiliateRow): Affiliate {
	return {
		id: row.id,
		userId: row.userId,
		name: row.name,
		email: row.email,
		company: row.company,
		channel: row.channel,
		country: row.country,
		payoutMethod: row.payoutMethod,
		status: row.status,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function mapLinkRecord(
	record: AffiliateAdminLinkRecord,
): AffiliateLinkListItem {
	return {
		link: {
			id: record.link.id,
			programId: record.link.programId,
			affiliateId: record.link.affiliateId,
			code: record.link.code,
			label: record.link.label,
			landingPath: record.link.landingPath,
			expiresAt: record.link.expiresAt?.toISOString() ?? null,
			active: record.link.active,
			status: linkStatus(record.link.active, record.link.expiresAt),
			createdAt: record.link.createdAt.toISOString(),
			updatedAt: record.link.updatedAt.toISOString(),
		},
		program: record.program,
		aggregates: {
			...record.aggregates,
			lastConversionAt:
				record.aggregates.lastConversionAt?.toISOString() ?? null,
		},
	};
}

function mapAttributionRecord(
	record: AffiliateAdminAttributionRecord,
): AffiliateAttributedUser {
	const row = record.attribution;
	const common = {
		id: row.id,
		userId: row.userId,
		linkId: row.linkId,
		affiliateId: row.affiliateId,
		programId: row.programId,
		commissionDurationMonths: row.commissionDurationMonths,
		clickedAt: row.clickedAt.toISOString(),
		lockedAt: row.lockedAt.toISOString(),
		source: row.source,
		status: row.status,
		fraudFlags: parseAffiliateFraudFlags(row.fraudFlags),
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		user: record.user,
		link: record.link,
		program: record.program,
		paidInvoiceCount: record.paidInvoiceCount,
		firstPaidAt: record.firstPaidAt?.toISOString() ?? null,
		lastPaidAt: record.lastPaidAt?.toISOString() ?? null,
		currencies: record.currencies,
	};

	if (row.programKind === "percentage_recurring") {
		return {
			...common,
			programKind: row.programKind,
			commissionRateBps: requireNumber(
				row.commissionRateBps,
				"percentage attribution commissionRateBps",
			),
			fixedAmountCents: null,
			fixedCurrency: null,
		};
	}

	return {
		...common,
		programKind: row.programKind,
		commissionRateBps: null,
		fixedAmountCents: requireNumber(
			row.fixedAmountCents,
			"fixed attribution fixedAmountCents",
		),
		fixedCurrency: requireString(
			row.fixedCurrency,
			"fixed attribution fixedCurrency",
		),
	};
}

function mapCommissionRecord(
	record: AffiliateAdminCommissionRecord,
): AffiliateCommissionLedgerEntry {
	const row = record.commission;
	const common = {
		id: row.id,
		attributionId: row.attributionId,
		affiliateId: row.affiliateId,
		stripeInvoiceId: row.stripeInvoiceId,
		stripeRefundId: row.stripeRefundId,
		stripeDisputeId: row.stripeDisputeId,
		stripeChargeId: row.stripeChargeId,
		currency: row.currency,
		baseAmountCents: row.baseAmountCents,
		rateBps: row.rateBps,
		status: row.status,
		holdUntil: row.holdUntil.toISOString(),
		payoutId: row.payoutId,
		reversalReason: row.reversalReason,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		affiliate: record.affiliate,
		attributedUser: record.attributedUser,
		link: record.link,
	};

	if (row.entryType === "earning") {
		return {
			...common,
			entryType: row.entryType,
			originalCommissionId: null,
			amountCents: row.amountCents,
		};
	}

	return {
		...common,
		entryType: row.entryType,
		originalCommissionId: requireString(
			row.originalCommissionId,
			"affiliate adjustment originalCommissionId",
		),
		amountCents: row.amountCents,
	};
}

function mapPayoutRecord(
	record: AffiliateAdminPayoutRecord,
): AffiliatePayoutListItem {
	return {
		payout: mapPayout(record.payout),
		affiliate: record.affiliate,
		entryCount: record.entryCount,
	};
}

function mapPayout(row: AffiliateAdminPayoutRow): AffiliatePayout {
	return {
		id: row.id,
		affiliateId: row.affiliateId,
		totalCents: row.totalCents,
		currency: row.currency,
		method: row.method,
		externalRef: row.externalRef,
		requestId: row.requestId,
		status: row.status,
		periodStart: row.periodStart.toISOString(),
		periodEnd: row.periodEnd.toISOString(),
		paidAt: row.paidAt?.toISOString() ?? null,
		createdByUserId: row.createdByUserId,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function linkStatus(
	active: boolean,
	expiresAt: Date | null,
): "active" | "expired" | "paused" {
	if (expiresAt && expiresAt.getTime() <= Date.now()) {
		return "expired";
	}

	return active ? "active" : "paused";
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function requireNumber(value: number | null, field: string): number {
	if (value === null) {
		throw new InternalServerErrorException(`Missing ${field}`);
	}

	return value;
}

function requireString(value: string | null, field: string): string {
	if (value === null) {
		throw new InternalServerErrorException(`Missing ${field}`);
	}

	return value;
}

function csvCell(value: Date | number | string | null): string {
	if (value === null) {
		return "";
	}

	let text = value instanceof Date ? value.toISOString() : String(value);
	if (typeof value === "string" && /^[=+\-@]/.test(text)) {
		text = `'${text}`;
	}

	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
