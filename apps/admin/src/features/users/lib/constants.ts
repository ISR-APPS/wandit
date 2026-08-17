import type {
	AdminListUsersSort,
	UserPlanFilter,
	UserPublishedFilter,
	UserRoleFilter,
	UserStatusFilter,
	UserVerifiedFilter,
} from "../api/users.dto";

export const USER_TABLE_PAGE_SIZES = [10, 20, 25, 30, 40, 50] as const;

export const USER_TABLE_DEFAULT_PAGE_SIZE = 25;

// Slider ceiling for the credits-used range filter. The max thumb parked at
// this edge means "no upper bound"; the numeric inputs accept larger values.
// Denominated in whole display credits (the API filter unit) — never scale
// this to centi-credits.
export const USER_CREDITS_USED_SLIDER_MAX = 1000;

type UserFacetedFilterOption<TValue extends string> = {
	label: string;
	value: TValue;
};

type UserSortOption = UserFacetedFilterOption<AdminListUsersSort>;

type UserSortOptionGroup = {
	label: string;
	options: readonly UserSortOption[];
};

export const USER_SORT_OPTION_GROUPS = [
	{
		label: "Signup date",
		options: [
			{ label: "Newest first", value: "newest" },
			{ label: "Oldest first", value: "oldest" },
		],
	},
	{
		label: "Alphabetical",
		options: [
			{ label: "Name", value: "name" },
			{ label: "Email", value: "email" },
		],
	},
	{
		label: "Usage",
		options: [
			{ label: "Most projects", value: "most_projects" },
			{ label: "Highest credit balance", value: "most_credits" },
			{ label: "Most credits used", value: "most_consumed" },
			{ label: "Recently active", value: "recently_seen" },
		],
	},
] as const satisfies readonly UserSortOptionGroup[];

export const USER_SORT_OPTIONS: readonly UserSortOption[] =
	USER_SORT_OPTION_GROUPS.flatMap<UserSortOption>((group) => group.options);

export const USER_PLAN_FILTER_OPTIONS = [
	{ label: "Free", value: "free" },
	{ label: "Pro", value: "pro" },
	{ label: "Business", value: "business" },
] as const satisfies readonly UserFacetedFilterOption<UserPlanFilter[number]>[];

export const USER_ROLE_FILTER_OPTIONS = [
	{ label: "User", value: "user" },
	{ label: "Admin", value: "admin" },
] as const satisfies readonly UserFacetedFilterOption<UserRoleFilter[number]>[];

export const USER_STATUS_FILTER_OPTIONS = [
	{ label: "Active", value: "active" },
	{ label: "Banned", value: "banned" },
] as const satisfies readonly UserFacetedFilterOption<
	UserStatusFilter[number]
>[];

export const USER_VERIFIED_FILTER_OPTIONS = [
	{ label: "Verified", value: "verified" },
	{ label: "Unverified", value: "unverified" },
] as const satisfies readonly UserFacetedFilterOption<
	UserVerifiedFilter[number]
>[];

export const USER_PUBLISHED_FILTER_OPTIONS = [
	{ label: "Not published", value: "unpublished" },
	{ label: "Wandit subdomain", value: "subdomain" },
	{ label: "Custom domain", value: "custom_domain" },
] as const satisfies readonly UserFacetedFilterOption<
	UserPublishedFilter[number]
>[];
