// Reads of the header alerts: the active members who have not come for two weeks, the longest gone first.
// HeaderNotifications reads it after the shell renders. The rule comes from lib/at-risk.ts,
// so the bell counts the same members as the home feed and the "At risk" filter of the members page.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { isAtRisk, lastVisitByMember } from "../lib/at-risk";
import { startOfLocalDay } from "../lib/gym-time";
import { activityOfDay, checkInsUntil } from "../lib/sample-activity";
import { membersOfDay } from "../lib/sample-members";
import { planOf } from "../lib/sample-plans";

// Each alert opens the page of its member. linkOptions types the path, so a wrong path fails typecheck.
function memberLink(memberId: string) {
	return linkOptions({ to: "/app/members/$memberId", params: { memberId } });
}

/** One alert of the bell menu. */
export type Alert = {
	/** Id of the member. */
	id: string;
	/** "atRisk": an active member with no visit for AT_RISK_DAYS days. The only kind for now. */
	kind: "atRisk";
	/** The full name of the member. */
	title: string;
	/** The plan name of the member. Data, not a UI text. */
	detail: string;
	/** ISO time of the last visit, or of the join day when the member never came. */
	at: string;
	link: ReturnType<typeof memberLink>;
};

/** Every alert, the longest gone first. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const now = Date.now();
			const todayStart = startOfLocalDay(now);
			const lastVisitOf = lastVisitByMember(
				checkInsUntil(activityOfDay(todayStart), now),
			);
			return membersOfDay(todayStart)
				.filter((member) =>
					isAtRisk(member, lastVisitOf.get(member.id) ?? null, now),
				)
				.map(
					(member): Alert => ({
						id: member.id,
						kind: "atRisk",
						title: member.fullName,
						detail: planOf(member.planId).name,
						at: new Date(
							lastVisitOf.get(member.id) ?? member.joinedAt,
						).toISOString(),
						link: memberLink(member.id),
					}),
				)
				.sort((first, second) => first.at.localeCompare(second.at));
		},
	});
}
