import { InternalServerErrorException } from "@nestjs/common";
import type {
	Affiliate,
	AffiliateAttributedUser,
	AffiliateCommissionLedgerEntry,
	AffiliateLinkListItem,
	AffiliatePayout,
	AffiliatePayoutListItem,
	AffiliateProgram,
	AffiliateProgramListItem,
	AffiliatesResponse,
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

export function mapProgramRecord(
	record: AffiliateAdminProgramRecord,
): AffiliateProgramListItem {
	return {
		program: mapProgram(record.program),
		aggregates: record.aggregates,
	};
}

export function mapProgram(row: AffiliateAdminProgramRow): AffiliateProgram {
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

export function mapAffiliateRecord(
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

export function mapLinkRecord(
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

export function mapAttributionRecord(
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

export function mapCommissionRecord(
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

export function mapPayoutRecord(
	record: AffiliateAdminPayoutRecord,
): AffiliatePayoutListItem {
	return {
		payout: mapPayout(record.payout),
		affiliate: record.affiliate,
		entryCount: record.entryCount,
	};
}

export function mapPayout(row: AffiliateAdminPayoutRow): AffiliatePayout {
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

export function recordOrNull(value: unknown): Record<string, unknown> | null {
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
