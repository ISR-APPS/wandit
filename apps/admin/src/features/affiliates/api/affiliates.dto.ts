export type AffiliateStatus = "active" | "paused" | "pending";

export type AffiliateCodeStatus = "active" | "paused" | "expired";

export type AffiliateChannel = "creator" | "agency" | "community" | "partner";

export type AffiliatePayoutMethod = "paypal" | "wise" | "bank-transfer";

export type AffiliatePerformance = {
	clicks: number;
	uniqueVisitors: number;
	signups: number;
	paidConversions: number;
	conversionRatePercent: number;
	revenueUsdMinor: number;
	commissionUsdMinor: number;
	paidCommissionUsdMinor: number;
	pendingCommissionUsdMinor: number;
};

export type AffiliateCode = {
	id: string;
	code: string;
	label: string;
	landingPath: string;
	status: AffiliateCodeStatus;
	commissionRatePercent: number;
	attributionWindowDays: number;
	createdAt: string;
	expiresAt: string | null;
	lastConversionAt: string | null;
	performance: AffiliatePerformance;
};

export type Affiliate = {
	id: string;
	userId: string | null;
	name: string;
	email: string;
	avatarUrl: string;
	company: string | null;
	channel: AffiliateChannel;
	status: AffiliateStatus;
	country: string;
	joinedAt: string;
	lastActiveAt: string;
	defaultCommissionRatePercent: number;
	payoutMethod: AffiliatePayoutMethod | null;
	payoutEmail: string | null;
	notes: string | null;
	codes: AffiliateCode[];
	performance: AffiliatePerformance;
};

export type AffiliateCodeDraft = {
	code: string;
	label: string;
	landingPath?: string;
	commissionRatePercent?: number;
	attributionWindowDays?: number;
	expiresAt?: string | null;
};

export type CreateAffiliateInput = {
	name: string;
	email: string;
	company?: string;
	channel: AffiliateChannel;
	country: string;
	defaultCommissionRatePercent: number;
	payoutMethod?: AffiliatePayoutMethod | null;
	payoutEmail?: string;
	notes?: string;
	initialCode?: AffiliateCodeDraft;
};

export type CreateAffiliateCodeInput = AffiliateCodeDraft & {
	affiliateId: string;
};

export type SetAffiliateStatusInput = {
	affiliateId: string;
	status: Exclude<AffiliateStatus, "pending">;
};

export type SetAffiliateCodeStatusInput = {
	affiliateId: string;
	codeId: string;
	status: Exclude<AffiliateCodeStatus, "expired">;
};

export type AffiliateSummary = Affiliate;
export type AffiliateDetail = Affiliate;
