// The math of the budgets page: the spend of each budget for one calendar month, its status, and the daily curve.
// budgets.queries.ts calls buildBudgetReport with the rows of the sample ledger. It reads no clock.
import {
	addDays,
	addMonths,
	type Budget,
	daysBetween,
	monthEndOf,
	monthStartOf,
	type Transaction,
} from "~/features/ledger";

/** The months that the page can show. The ledger keeps 90 days, so the month before is always complete. */
export const BUDGET_MONTHS = ["current", "previous"] as const;

/** One month choice. Its label is the name of the month. */
export type BudgetMonth = (typeof BUDGET_MONTHS)[number];

/** The states of a budget, the worst first. The label is the message key `budgets.statuses.<status>`. */
export const BUDGET_STATUSES = ["over", "ahead", "within"] as const;

/** One state of a budget. */
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];

/** One budget with its spend in the month. */
export type BudgetLine = Budget & {
	/** The spend of the category in the month, in cents and positive. */
	spentCents: number;
	status: BudgetStatus;
	/** The expenses of the category in the month, newest first. Their sum is `spentCents`. */
	transactions: Transaction[];
};

/** One day of the spend curve. */
export type BurnPoint = {
	/** `YYYY-MM-DD`. */
	day: string;
	/** The spend of every budget from day 1 to this day, in cents. null for a day after today. */
	spentCents: number | null;
	/** The plan for this day: the total budget, spread evenly over the month. In cents. */
	planCents: number;
};

/** Everything that the budgets page shows for one month. */
export type BudgetReport = {
	month: BudgetMonth;
	/** The first and the last day of the month, as `YYYY-MM-DD`. */
	monthStart: string;
	monthEnd: string;
	/** Count of the days of the month. */
	dayCount: number;
	/** Count of the days of the month up to today. Equal to `dayCount` for a closed month. */
	elapsedDays: number;
	/** The sum of every limit, in cents. */
	budgetedCents: number;
	/** The spend of every budget, in cents. An expense with no budget does not count. */
	spentCents: number;
	/** The budgets, the most used first. */
	lines: BudgetLine[];
	/** The expenses of the month in a category with no budget, for example taxes. In cents and positive. */
	unbudgetedCents: number;
	/** One point per day of the month, oldest first. */
	burn: BurnPoint[];
	/** The largest expenses of the month in a budget, the largest first. */
	largest: Transaction[];
};

// A variable budget is ahead of pace when its used share is 15 points above the share of the month that passed.
const AHEAD_MARGIN = 0.15;
// The card of the largest expenses lists this many rows.
const LARGEST_COUNT = 5;

function statusOf(
	budget: Budget,
	spentCents: number,
	monthShare: number,
): BudgetStatus {
	if (spentCents > budget.limitCents) {
		return "over";
	}
	// A fixed budget pays its bills on set days, so the pace of the month does not judge it.
	const isAhead =
		budget.rhythm === "variable" &&
		monthShare < 1 &&
		spentCents / budget.limitCents > monthShare + AHEAD_MARGIN;
	return isAhead ? "ahead" : "within";
}

/**
 * The report of one month. `rows` is every entry of the ledger, newest first. `today` is `YYYY-MM-DD`.
 * "previous" is the calendar month before the month of `today`.
 */
export function buildBudgetReport(
	month: BudgetMonth,
	rows: Transaction[],
	budgets: Budget[],
	today: string,
): BudgetReport {
	const monthStart =
		month === "current" ? monthStartOf(today) : addMonths(today, -1);
	const monthEnd = monthEndOf(monthStart);
	const dayCount = daysBetween(monthStart, monthEnd) + 1;
	const elapsedDays =
		month === "current" ? daysBetween(monthStart, today) + 1 : dayCount;
	// `YYYY-MM-DD` texts compare in date order.
	const expenses = rows.filter(
		(row) =>
			row.type === "expense" && row.day >= monthStart && row.day <= monthEnd,
	);
	const lines = budgets.map((budget) => {
		const transactions = expenses.filter(
			(row) => row.categoryId === budget.categoryId,
		);
		const spentCents = transactions.reduce(
			(sum, row) => sum - row.amountCents,
			0,
		);
		return {
			...budget,
			spentCents,
			status: statusOf(budget, spentCents, elapsedDays / dayCount),
			transactions,
		};
	});
	const budgeted = expenses.filter((row) =>
		budgets.some((budget) => budget.categoryId === row.categoryId),
	);
	const budgetedCents = budgets.reduce(
		(sum, budget) => sum + budget.limitCents,
		0,
	);
	const spentCents = lines.reduce((sum, line) => sum + line.spentCents, 0);

	let runningCents = 0;
	const burn = Array.from({ length: dayCount }, (_, index) => {
		const day = addDays(monthStart, index);
		for (const row of budgeted) {
			if (row.day === day) {
				runningCents -= row.amountCents;
			}
		}
		return {
			day,
			spentCents: index < elapsedDays ? runningCents : null,
			planCents: Math.round((budgetedCents * (index + 1)) / dayCount),
		};
	});

	return {
		month,
		monthStart,
		monthEnd,
		dayCount,
		elapsedDays,
		budgetedCents,
		spentCents,
		lines: lines.sort(
			(first, second) =>
				second.spentCents / second.limitCents -
				first.spentCents / first.limitCents,
		),
		unbudgetedCents:
			expenses.reduce((sum, row) => sum - row.amountCents, 0) - spentCents,
		burn,
		largest: [...budgeted]
			.sort((first, second) => first.amountCents - second.amountCents)
			.slice(0, LARGEST_COUNT),
	};
}
