// The fixed value lists of an account and of a person: plan, region, platform, sign-up channel, and role.
// The sample tables pick from them. The pages translate each value with its message group.
// A later database keeps the same values as check constraints.

/** The plans, from the smallest to the largest. Labels: `plans.<plan>`. */
export const PLANS = ["free", "team", "business", "enterprise"] as const;

/** One plan of an account. */
export type Plan = (typeof PLANS)[number];

/** The sales regions of an account. Labels: `regions.<region>`. */
export const REGIONS = ["americas", "emea", "apac"] as const;

/** One region. It also sets the hours of the day when the people of an account work. */
export type Region = (typeof REGIONS)[number];

/** Where a person uses the product most. Labels: `platforms.<platform>`. */
export const PLATFORMS = ["web", "desktop", "ios", "android"] as const;

/** One platform. Each person has one, so the platform counts add up to the active people. */
export type Platform = (typeof PLATFORMS)[number];

/** How a new person found the product. Labels: `channels.<channel>`. */
export const CHANNELS = [
	"invite",
	"organic",
	"direct",
	"referral",
	"paid",
] as const;

/** One sign-up channel. `invite` is a teammate that an existing member invited. */
export type Channel = (typeof CHANNELS)[number];

/** The role of a person in the workspace of the account. Labels: `roles.<role>`. */
export const ROLES = ["admin", "member", "viewer"] as const;

/** One role. */
export type Role = (typeof ROLES)[number];
