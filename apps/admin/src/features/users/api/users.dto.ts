export type UserRole = "user" | "affiliate" | "admin" | "owner";

export type UserPlan = "free" | "starter" | "pro";

export type PaymentProvider = "stripe" | "chargily";

export type SubscriptionStatus = "active" | "past-due" | "canceled";

export type Currency = "USD" | "DZD";

export type UserWebsiteStatus = "published" | "draft" | "failed";

export type UserAssetType = "image" | "video" | "document" | "audio";

/**
 * Flat row model used by the users table. Monetary values are always stored
 * in the currency's minor unit (cents/centimes), never as floating-point
 * major-unit values.
 */
export type UserSummary = {
	id: string;
	name: string;
	email: string;
	avatarUrl: string;
	role: UserRole;
	plan: UserPlan;
	paymentProvider: PaymentProvider | null;
	subscriptionStatus: SubscriptionStatus | null;
	monthlyAmountMinor: number;
	currency: Currency | null;
	renewalAt: string | null;
	creditsBalance: number;
	isBanned: boolean;
	banReason: string | null;
	bannedAt: string | null;
	signedUpAt: string;
	lastSeenAt: string;
	country: string;
	locale: string;
	tokensThisPeriod: number;
	tokensLifetime: number;
	tokenCostUsdMinor: number;
	websitesGenerated: number;
	assetsGenerated: number;
};

export type UserWebsite = {
	id: string;
	name: string;
	url: string | null;
	status: UserWebsiteStatus;
	generationCount: number;
	createdAt: string;
	lastGeneratedAt: string;
};

export type UserAsset = {
	id: string;
	name: string;
	type: UserAssetType;
	source: string;
	model: string | null;
	sizeLabel: string;
	createdAt: string;
};

export type CreditLedgerEntry = {
	id: string;
	amount: number;
	balanceAfter: number;
	type: "grant" | "purchase" | "generation" | "refund" | "adjustment";
	note: string;
	actor: string;
	createdAt: string;
};

export type UserActivity = {
	id: string;
	type: "signup" | "login" | "generation" | "publish" | "credit" | "admin";
	title: string;
	description: string;
	createdAt: string;
};

export type UserDetail = UserSummary & {
	lastSignInAt: string;
	billingCustomerId: string | null;
	websites: UserWebsite[];
	assets: UserAsset[];
	creditLedger: CreditLedgerEntry[];
	activity: UserActivity[];
};

export type GrantUserCreditsInput = {
	userId: string;
	amount: number;
	reason?: string;
};

export type ChangeUserRoleInput = {
	userId: string;
	role: UserRole;
};

export type SetUserBannedInput = {
	userId: string;
	banned: boolean;
	reason?: string;
};

// Compatibility aliases for feature code written during the first mock pass.
export type AdminUserRole = UserRole;
export type AdminUserPlan = UserPlan;
export type AdminPaymentProvider = PaymentProvider;
export type AdminSubscriptionStatus = SubscriptionStatus;
export type AdminCurrency = Currency;
export type AdminWebsiteStatus = UserWebsiteStatus;
export type AdminAssetKind = UserAssetType;
export type AdminAssetSource = "generated" | "uploaded";
export type AdminCreditEntryKind = CreditLedgerEntry["type"];
export type AdminUserActivityKind = UserActivity["type"];
export type AdminUserSummary = UserSummary;
export type AdminUserWebsite = UserWebsite;
export type AdminUserAsset = UserAsset;
export type AdminCreditLedgerEntry = CreditLedgerEntry;
export type AdminUserActivity = UserActivity;
export type AdminUserDetail = UserDetail;
