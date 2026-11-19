// Pure functions of the plans page: the members and the monthly value of each plan, and the 4 KPIs of the page.
// plans.queries.ts calls them. They read only their arguments. Amounts are whole units of PLAN_CURRENCY.
// Only active members pay. A frozen member pays again on the first day back.
import {
	addDays,
	changeRatio,
	isTrainingOn,
	type Member,
	monthlyValueOf,
	PLANS,
	type Plan,
	type PlanId,
	planOf,
} from "~/features/gym";

/** The KPI deltas compare today with this many days ago: one billing month. */
export const COMPARE_DAYS = 30;

/** One plan with its members. The row id is the plan id. */
export type PlanRow = {
	id: PlanId;
	plan: Plan;
	/** Members with the status active on this plan. They pay. */
	activeCount: number;
	/** Members with the status frozen on this plan. They pay nothing until they come back. */
	frozenCount: number;
	/** Monthly value of the active members: an annual price counts one twelfth. */
	monthlyValue: number;
};

/** One KPI of the plans page, with its change against COMPARE_DAYS days ago. null: no earlier data. */
export type PlanKpi = { value: number; change: number | null };

/** Everything that the plans page shows. */
export type PlansOverview = {
	/** One row per plan, in the order of PLANS. */
	rows: PlanRow[];
	/** Monthly value of every active member. */
	monthlyRevenue: PlanKpi;
	/** Members who pay now. */
	payingMembers: PlanKpi;
	/** Monthly value per paying member. 0 when nobody pays. */
	averagePerMember: PlanKpi;
	/** Members on a freeze. A fall is good news. */
	frozenMembers: PlanKpi;
};

// Whether the member is on a freeze on the local day `dayStart`.
function isFrozenOn(member: Member, dayStart: number): boolean {
	return (
		member.joinedAt <= dayStart &&
		member.frozenFrom !== null &&
		member.frozenUntil !== null &&
		dayStart >= member.frozenFrom &&
		dayStart < member.frozenUntil
	);
}

/** The plans page data at the local midnight `todayStart`. */
export function buildPlansOverview(
	members: readonly Member[],
	todayStart: number,
): PlansOverview {
	const before = addDays(todayStart, -COMPARE_DAYS);
	const payingNow = members.filter((member) =>
		isTrainingOn(member, todayStart),
	);
	const payingBefore = members.filter((member) => isTrainingOn(member, before));
	const revenueOf = (rows: Member[]) =>
		rows.reduce(
			(sum, member) => sum + monthlyValueOf(planOf(member.planId)),
			0,
		);
	const revenueNow = revenueOf(payingNow);
	const revenueBefore = revenueOf(payingBefore);
	const averageNow = payingNow.length === 0 ? 0 : revenueNow / payingNow.length;
	const averageBefore =
		payingBefore.length === 0 ? 0 : revenueBefore / payingBefore.length;
	const frozenNow = members.filter((member) =>
		isFrozenOn(member, todayStart),
	).length;
	const frozenBefore = members.filter((member) =>
		isFrozenOn(member, before),
	).length;

	return {
		rows: PLANS.map((plan) => {
			const activeCount = payingNow.filter(
				(member) => member.planId === plan.id,
			).length;
			return {
				id: plan.id,
				plan,
				activeCount,
				frozenCount: members.filter(
					(member) =>
						member.planId === plan.id && isFrozenOn(member, todayStart),
				).length,
				monthlyValue: activeCount * monthlyValueOf(plan),
			};
		}),
		monthlyRevenue: {
			value: revenueNow,
			change: changeRatio(revenueNow, revenueBefore),
		},
		payingMembers: {
			value: payingNow.length,
			change: changeRatio(payingNow.length, payingBefore.length),
		},
		averagePerMember: {
			value: averageNow,
			change: changeRatio(averageNow, averageBefore),
		},
		frozenMembers: {
			value: frozenNow,
			change: changeRatio(frozenNow, frozenBefore),
		},
	};
}
