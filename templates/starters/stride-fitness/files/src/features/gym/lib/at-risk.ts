// The "at risk" rule: an active member who has not come for AT_RISK_DAYS days.
// The members rows, the home feed, and the bell alerts call it, so all three count the same members.
// It reads only its arguments. Times are milliseconds since 1970.
import { DAY_MS } from "./gym-time";
import type { MemberStatus } from "./sample-members";

/** 14 days. Two weeks without a visit is the usual sign that a member is about to cancel. */
export const AT_RISK_DAYS = 14;

/**
 * Whether a member is at risk at `now`: active, a member for AT_RISK_DAYS or more,
 * and no check-in in the last AT_RISK_DAYS days. `lastVisitAt` is null when the member never came.
 */
export function isAtRisk(
	member: { status: MemberStatus; joinedAt: number },
	lastVisitAt: number | null,
	now: number,
): boolean {
	const limit = now - AT_RISK_DAYS * DAY_MS;
	// A new member had no time to build a habit yet, so the rule waits.
	if (member.status !== "active" || member.joinedAt > limit) {
		return false;
	}
	return lastVisitAt === null || lastVisitAt < limit;
}

/** The time of the newest check-in of each member. `checkIns` is oldest first, as the sample keeps them. */
export function lastVisitByMember(
	checkIns: readonly { memberId: string; at: number }[],
): Map<string, number> {
	const lastVisitOf = new Map<string, number>();
	// The last write per member wins, and the check-ins are oldest first.
	for (const checkIn of checkIns) {
		lastVisitOf.set(checkIn.memberId, checkIn.at);
	}
	return lastVisitOf;
}
