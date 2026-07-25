import type {
	AffiliateChannel,
	AffiliatePayoutMethod,
	AffiliateStatus,
} from "../api/affiliates.dto";

type FilterOption<TValue extends string> = {
	label: string;
	value: TValue;
};

export const AFFILIATE_STATUS_OPTIONS = [
	{ label: "Active", value: "active" },
	{ label: "Paused", value: "paused" },
	{ label: "Pending", value: "pending" },
] as const satisfies readonly FilterOption<AffiliateStatus>[];

export const AFFILIATE_CHANNEL_OPTIONS = [
	{ label: "Creator", value: "creator" },
	{ label: "Agency", value: "agency" },
	{ label: "Community", value: "community" },
	{ label: "Partner", value: "partner" },
] as const satisfies readonly FilterOption<AffiliateChannel>[];

export const AFFILIATE_PAYOUT_METHOD_OPTIONS = [
	{ label: "PayPal", value: "paypal" },
	{ label: "Wise", value: "wise" },
	{ label: "Bank transfer", value: "bank-transfer" },
] as const satisfies readonly FilterOption<AffiliatePayoutMethod>[];

export const AFFILIATE_CODE_STATUS_OPTIONS = [
	{ label: "Active", value: "active" },
	{ label: "Paused", value: "paused" },
	{ label: "Expired", value: "expired" },
] as const;

export const AFFILIATE_PERFORMANCE_OPTIONS = [
	{ label: "Has conversions", value: "converting" },
	{ label: "No conversions", value: "no-conversions" },
	{ label: "Top revenue", value: "top-revenue" },
] as const;

export const AFFILIATE_TABLE_DEFAULT_PAGE_SIZE = 10;

export const TOP_AFFILIATE_REVENUE_USD_MINOR = 1_500_000;
