// The status of a new user on the Reports page, the rule that gives it, and the Badge variant of each status.
// The reports query calls the rule. The recent sign-ups table reads the badge map.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";

/** Every status, from the best to the worst. Labels: `reports.statuses.<status>`. */
export const SIGN_UP_STATUSES = ["activated", "exploring", "dropped"] as const;

/** One status of a new user. */
export type SignUpStatus = (typeof SIGN_UP_STATUSES)[number];

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Badge variant per status. "dropped" is the only one that asks for an action. */
export const SIGN_UP_STATUS_BADGE = {
	activated: "success",
	exploring: "info",
	dropped: "destructive",
} satisfies Record<SignUpStatus, BadgeVariant>;

/** A new user that is not activated still "explores" when the last event is at most this many days old. */
const EXPLORING_DAYS = 7;

/** Activated first; else exploring while recently active; else dropped. `lastActiveDaysAgo` null means no event. */
export function signUpStatusOf(
	isActivated: boolean,
	lastActiveDaysAgo: number | null,
): SignUpStatus {
	if (isActivated) {
		return "activated";
	}
	return lastActiveDaysAgo !== null && lastActiveDaysAgo <= EXPLORING_DAYS
		? "exploring"
		: "dropped";
}
