// The health status of an account, the rule that gives it, and the Badge variant of each status.
// The account queries call the rule. The account list, the account page, and the home read the badge map.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";

/** Every status, from the best to the worst. The tabs of the list follow this order. */
export const ACCOUNT_STATUSES = [
	"healthy",
	"new",
	"at_risk",
	"dormant",
] as const;

/** One status. Its label is the message key `accounts.statuses.<status>`. */
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Badge variant per status. At risk is the only one that asks for an action. */
export const ACCOUNT_STATUS_BADGE = {
	healthy: "success",
	new: "info",
	at_risk: "warning",
	dormant: "secondary",
} satisfies Record<AccountStatus, BadgeVariant>;

/** An account is "new" for this many days after its creation. */
const NEW_ACCOUNT_DAYS = 7;

/** An account is "dormant" when its last event is more than this many days old. */
const DORMANT_AFTER_DAYS = 14;

/** An account is "at risk" when its active people fell by this share or more against the 30 days before. */
const AT_RISK_DROP = 0.2;

/** The facts that the status rule reads. All of them cover complete days. */
type AccountHealth = {
	/** The age of the account in days. */
	createdDaysAgo: number;
	/** Days since the last event. null when the account has no event in the history. */
	lastSeenDaysAgo: number | null;
	/** Active people of the last 30 days. */
	activePeople: number;
	/** Active people of the 30 days before. */
	previousActivePeople: number;
};

/** The first rule that matches wins: dormant, new, at risk, then healthy. */
export function accountStatusOf(health: AccountHealth): AccountStatus {
	if (
		health.lastSeenDaysAgo === null ||
		health.lastSeenDaysAgo > DORMANT_AFTER_DAYS
	) {
		return "dormant";
	}
	if (health.createdDaysAgo <= NEW_ACCOUNT_DAYS) {
		return "new";
	}
	// A fall from 10 people to 8 is the limit: 8 is not above 10 minus 20 %.
	const isFalling =
		health.previousActivePeople > 0 &&
		health.activePeople <= health.previousActivePeople * (1 - AT_RISK_DROP);
	return isFalling ? "at_risk" : "healthy";
}
