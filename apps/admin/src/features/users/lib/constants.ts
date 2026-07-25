import type {
	PaymentProvider,
	SubscriptionStatus,
	UserPlan,
	UserRole,
} from "../api/users.dto";

type FilterOption<TValue extends string> = {
	label: string;
	value: TValue;
};

export const USER_ROLE_OPTIONS = [
	{ label: "User", value: "user" },
	{ label: "Affiliate", value: "affiliate" },
	{ label: "Admin", value: "admin" },
	{ label: "Owner", value: "owner" },
] as const satisfies readonly FilterOption<UserRole>[];

export const USER_PLAN_OPTIONS = [
	{ label: "Free", value: "free" },
	{ label: "Starter", value: "starter" },
	{ label: "Pro", value: "pro" },
] as const satisfies readonly FilterOption<UserPlan>[];

export const USER_PAYMENT_PROVIDER_OPTIONS = [
	{ label: "Stripe", value: "stripe" },
	{ label: "Chargily", value: "chargily" },
] as const satisfies readonly FilterOption<PaymentProvider>[];

export const USER_SUBSCRIPTION_STATUS_OPTIONS = [
	{ label: "Active", value: "active" },
	{ label: "Past due", value: "past-due" },
	{ label: "Canceled", value: "canceled" },
] as const satisfies readonly FilterOption<SubscriptionStatus>[];

export const USER_BANNED_OPTIONS = [
	{ label: "Active access", value: "active" },
	{ label: "Banned", value: "banned" },
] as const;

export const USER_TABLE_PAGE_SIZES = [10, 20, 25, 30, 40, 50] as const;

export const USER_TABLE_DEFAULT_PAGE_SIZE = 25;

export const CREDIT_GRANT_PRESETS = [100, 500, 1_000, 5_000] as const;
