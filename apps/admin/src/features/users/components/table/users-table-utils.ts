import type { AdminUserSummary } from "@/features/users/api/users.dto";

type UserTablePresetId =
	| "all"
	| "paying"
	| "staff"
	| "affiliates"
	| "past-due"
	| "banned"
	| "high-usage"
	| "new-this-week";

const HIGH_USAGE_TOKEN_THRESHOLD = 5_000_000;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1_000;

const USER_TABLE_PRESETS: readonly {
	id: UserTablePresetId;
	label: string;
}[] = [
	{ id: "all", label: "All" },
	{ id: "paying", label: "Paying" },
	{ id: "staff", label: "Staff" },
	{ id: "affiliates", label: "Affiliates" },
	{ id: "past-due", label: "Past due" },
	{ id: "banned", label: "Banned" },
	{ id: "high-usage", label: "High usage" },
	{ id: "new-this-week", label: "New this week" },
];

function isNewThisWeek(user: AdminUserSummary) {
	const signupTime = new Date(user.signedUpAt).getTime();
	return signupTime >= Date.now() - ONE_WEEK_MS;
}

function matchesPreset(
	user: AdminUserSummary,
	preset: UserTablePresetId,
): boolean {
	switch (preset) {
		case "paying":
			return user.plan !== "free";
		case "staff":
			return user.role === "admin" || user.role === "owner";
		case "affiliates":
			return user.role === "affiliate";
		case "past-due":
			return user.subscriptionStatus === "past-due";
		case "banned":
			return user.isBanned;
		case "high-usage":
			return user.tokensLifetime >= HIGH_USAGE_TOKEN_THRESHOLD;
		case "new-this-week":
			return isNewThisWeek(user);
		case "all":
			return true;
	}
}

function getInitials(name: string) {
	return name
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part.charAt(0))
		.join("")
		.toUpperCase();
}

function titleCase(value: string) {
	return value
		.replaceAll("-", " ")
		.replace(/\b\w/g, (character) => character.toUpperCase());
}

export type { UserTablePresetId };
export {
	getInitials,
	HIGH_USAGE_TOKEN_THRESHOLD,
	isNewThisWeek,
	matchesPreset,
	titleCase,
	USER_TABLE_PRESETS,
};
