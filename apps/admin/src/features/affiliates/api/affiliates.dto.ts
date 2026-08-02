import type {
	AffiliateCurrencyAggregate,
	AffiliateDetail,
	AffiliateLinkListItem,
	AffiliateListItem,
	AffiliatePayoutMethod,
	AffiliateStatus,
} from "@wandit/contracts";

/**
 * The list contract deliberately keeps the affiliate record and its aggregates
 * separate. The table uses a flat row so sorting and cell rendering stay
 * straightforward without inventing mock-only fields.
 */
export type AffiliateTableRow = {
	id: string;
	userId: string | null;
	name: string;
	email: string;
	company: string | null;
	channel: string | null;
	country: string | null;
	payoutMethod: AffiliatePayoutMethod;
	status: AffiliateStatus;
	createdAt: string;
	updatedAt: string;
	linkCount: number;
	activeLinkCount: number;
	clickCount: number;
	uniqueVisitorCount: number;
	attributedUserCount: number;
	paidCustomerCount: number;
	paidInvoiceCount: number;
	lastConversionAt: string | null;
	currencies: AffiliateCurrencyAggregate[];
};

export type AffiliateLinkTableRow = {
	id: string;
	affiliateId: string;
	programId: string;
	programName: string;
	programKind: AffiliateLinkListItem["program"]["kind"];
	programStatus: AffiliateLinkListItem["program"]["status"];
	code: string;
	label: string | null;
	landingPath: string;
	expiresAt: string | null;
	active: boolean;
	status: AffiliateLinkListItem["link"]["status"];
	createdAt: string;
	updatedAt: string;
	clickCount: number;
	uniqueVisitorCount: number;
	attributedUserCount: number;
	paidCustomerCount: number;
	paidInvoiceCount: number;
	lastConversionAt: string | null;
	currencies: AffiliateCurrencyAggregate[];
};

export function mapAffiliateListItemToTableRow(
	item: AffiliateListItem,
): AffiliateTableRow {
	return {
		...item.affiliate,
		...item.aggregates,
		currencies: item.aggregates.currencies.map((currency) => ({
			...currency,
		})),
	};
}

export function mapAffiliateDetailToTableRow(
	detail: AffiliateDetail,
): AffiliateTableRow {
	return mapAffiliateListItemToTableRow({
		affiliate: detail.affiliate,
		aggregates: detail.aggregates,
	});
}

export function mapAffiliateLinkListItemToTableRow(
	item: AffiliateLinkListItem,
): AffiliateLinkTableRow {
	return {
		id: item.link.id,
		affiliateId: item.link.affiliateId,
		programId: item.link.programId,
		programName: item.program.name,
		programKind: item.program.kind,
		programStatus: item.program.status,
		code: item.link.code,
		label: item.link.label,
		landingPath: item.link.landingPath,
		expiresAt: item.link.expiresAt,
		active: item.link.active,
		status: item.link.status,
		createdAt: item.link.createdAt,
		updatedAt: item.link.updatedAt,
		...item.aggregates,
		currencies: item.aggregates.currencies.map((currency) => ({
			...currency,
		})),
	};
}
