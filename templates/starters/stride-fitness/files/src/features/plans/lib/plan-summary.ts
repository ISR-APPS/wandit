// Pure functions of the plans page: the members and the monthly value of each plan, and the payments ahead.
// plans.queries.ts calls them. They read only their arguments. Amounts are whole units of PLAN_CURRENCY.
// Only active members pay. A frozen member pays again on the first day back.
import {
	addDays,
	type Member,
	monthlyValueOf,
	nextPaymentOn,
	PLANS,
	type Plan,
	type PlanId,
	planOf,
} from "~/features/gym";

/** The days of the payments panel. Two weeks give the front desk time to call before a card fails. */
export const PAYMENT_WINDOW_DAYS = 14;

/** The chart color of each plan: the donut slice and the mark on the plan card agree. */
export const PLAN_CHART_COLOR = {
	unlimited: { fill: "var(--chart-1)", mark: "bg-chart-1" },
	annual: { fill: "var(--chart-2)", mark: "bg-chart-2" },
	eight: { fill: "var(--chart-3)", mark: "bg-chart-3" },
	"off-peak": { fill: "var(--chart-4)", mark: "bg-chart-4" },
	student: { fill: "var(--chart-5)", mark: "bg-chart-5" },
} satisfies Record<PlanId, { fill: string; mark: string }>;

/** One plan with its members. */
export type PlanSummary = {
	plan: Plan;
	/** Members with the status active on this plan. They pay. */
	activeCount: number;
	/** Members with the status frozen on this plan. They pay nothing until they come back. */
	frozenCount: number;
	/** Monthly value of the active members: an annual price counts one twelfth. */
	monthlyValue: number;
};

/** One summary per plan, in the order of PLANS. The active counts add up to the active members of the gym. */
export function buildPlanSummaries(members: readonly Member[]): PlanSummary[] {
	return PLANS.map((plan) => {
		const ofPlan = members.filter((member) => member.planId === plan.id);
		const activeCount = ofPlan.filter(
			(member) => member.status === "active",
		).length;
		return {
			plan,
			activeCount,
			frozenCount: ofPlan.filter((member) => member.status === "frozen").length,
			monthlyValue: activeCount * monthlyValueOf(plan),
		};
	});
}

/** One payment ahead. */
export type UpcomingPayment = {
	memberId: string;
	fullName: string;
	/** Name of the plan. Data, not a UI text. */
	planName: string;
	/** "return": the first payment after a freeze. "renewal": the usual monthly or yearly payment. */
	kind: "renewal" | "return";
	/** Local midnight of the payment day. */
	dueAt: number;
	/** The plan price, in whole units of PLAN_CURRENCY. */
	amount: number;
};

/** The payments from today to PAYMENT_WINDOW_DAYS days ahead, the earliest first. Lapsed members pay nothing. */
export function buildUpcomingPayments(
	members: readonly Member[],
	todayStart: number,
): UpcomingPayment[] {
	const windowEnd = addDays(todayStart, PAYMENT_WINDOW_DAYS);
	return members
		.flatMap((member): UpcomingPayment[] => {
			const dueAt = nextPaymentOn(member, todayStart);
			if (dueAt === null || dueAt >= windowEnd) {
				return [];
			}
			const plan = planOf(member.planId);
			return [
				{
					memberId: member.id,
					fullName: member.fullName,
					planName: plan.name,
					kind: member.status === "frozen" ? "return" : "renewal",
					dueAt,
					amount: plan.price,
				},
			];
		})
		.sort(
			(first, second) =>
				first.dueAt - second.dueAt ||
				first.fullName.localeCompare(second.fullName),
		);
}
