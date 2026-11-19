// The math of the home: the four KPI figures of a period, the card spend per day, the spend by category,
// the money in and out per month, and the balance line of one account.
// overview.queries.ts calls these pure functions with the sample rows. A later version runs the same math in SQL.
import {
	type AccountId,
	addMonths,
	changeRatio,
	countsInBalance,
	type DailyBalance,
	daysBetween,
	directionOf,
	lastDays,
	monthStartOf,
	type PeriodDays,
	type Transaction,
	type TransactionCategory,
} from "~/features/bank";

/** One KPI figure: the value of the period and the change against the period just before. */
export type Figure = {
	/** Positive cents. Money out and card spend are positive too. */
	cents: number;
	/** Ratio: 0.12 is +12 %. null when the period before has 0: the card then shows "No earlier data". */
	change: number | null;
};

/** One part of the spend by category. `category` is a code; the page translates it. */
export type SpendingSlice = {
	category: TransactionCategory | "other";
	/** Positive cents. */
	cents: number;
};

/** Everything the home shows for one period. */
export type OverviewSummary = {
	/** The total of the three accounts at the end of today, against the end of the day before the period. */
	balance: Figure;
	moneyIn: Figure;
	moneyOut: Figure;
	cardSpend: Figure;
	/** Card spend per day of the period, oldest first, in positive cents. Feeds the mini bars. */
	cardSpendByDay: { day: string; cents: number }[];
	/** Money out of the period by category: the 3 largest, then "other". */
	spending: SpendingSlice[];
};

/** Money in and money out of one calendar month, in positive cents. */
export type MonthFlow = {
	/** The first day of the month, `YYYY-MM-01`. */
	month: string;
	inCents: number;
	outCents: number;
};

/** One point of the balance line: the end-of-day balance, in cents. */
export type BalancePoint = { day: string; cents: number };

/** "all" sums the three accounts. */
export type BalanceScope = AccountId | "all";

// The donut shows this many categories and folds the rest into "other", so the 2 x 2 tiles stay full.
const SHOWN_CATEGORIES = 3;

// The cash flow chart shows this many calendar months, the current month included.
const FLOW_MONTHS = 6;

// The sum in cents of the rows that pass `keep`, booked from `fromAge` to `toAge` days before today.
function sumByAge(
	rows: Transaction[],
	today: string,
	fromAge: number,
	toAge: number,
	keep: (row: Transaction) => boolean,
): number {
	let total = 0;
	for (const row of rows) {
		const age = daysBetween(row.day, today);
		if (age >= fromAge && age <= toAge && countsInBalance(row) && keep(row)) {
			total += row.amountCents;
		}
	}
	return total;
}

// One figure of positive cents with its change against the same number of days just before.
function figureOf(
	rows: Transaction[],
	today: string,
	days: number,
	keep: (row: Transaction) => boolean,
): Figure {
	// Money out is negative in the rows. Math.abs gives the positive figure of the card.
	const current = Math.abs(sumByAge(rows, today, 0, days - 1, keep));
	const previous = Math.abs(sumByAge(rows, today, days, days * 2 - 1, keep));
	return { cents: current, change: changeRatio(current, previous) };
}

/**
 * The figures of the home for the last `days` days. Transfers between the accounts are not money in
 * or money out: they stay inside the business. `rows` is every entry; `balances` is oldest first.
 */
export function buildOverviewSummary(
	rows: Transaction[],
	balances: DailyBalance[],
	today: string,
	days: PeriodDays,
): OverviewSummary {
	const isIn = (row: Transaction) => directionOf(row) === "in";
	const isOut = (row: Transaction) => directionOf(row) === "out";
	const isCard = (row: Transaction) => row.method === "card";

	const balanceToday = balances.at(-1)?.totalCents ?? 0;
	// The end of the day before the period: the balance that the period started from.
	const balanceBefore = balances.at(-days - 1)?.totalCents ?? 0;

	const cardByDay = new Map<string, number>();
	const byCategory = new Map<TransactionCategory, number>();
	for (const row of rows) {
		if (daysBetween(row.day, today) >= days || !countsInBalance(row)) {
			continue;
		}
		if (isCard(row)) {
			cardByDay.set(row.day, (cardByDay.get(row.day) ?? 0) - row.amountCents);
		}
		if (isOut(row)) {
			byCategory.set(
				row.category,
				(byCategory.get(row.category) ?? 0) - row.amountCents,
			);
		}
	}
	const sorted = [...byCategory.entries()]
		.map(([category, cents]): SpendingSlice => ({ category, cents }))
		.sort((first, second) => second.cents - first.cents);
	const otherCents = sorted
		.slice(SHOWN_CATEGORIES)
		.reduce((sum, slice) => sum + slice.cents, 0);

	return {
		balance: {
			cents: balanceToday,
			change: changeRatio(balanceToday, balanceBefore),
		},
		moneyIn: figureOf(rows, today, days, isIn),
		moneyOut: figureOf(rows, today, days, isOut),
		cardSpend: figureOf(rows, today, days, isCard),
		cardSpendByDay: lastDays(today, days).map((day) => ({
			day,
			cents: cardByDay.get(day) ?? 0,
		})),
		spending:
			otherCents > 0
				? [
						...sorted.slice(0, SHOWN_CATEGORIES),
						{ category: "other", cents: otherCents },
					]
				: sorted,
	};
}

/** Money in and money out of the last 6 calendar months, oldest first. The current month runs to today. */
export function buildCashFlow(rows: Transaction[], today: string): MonthFlow[] {
	const thisMonth = monthStartOf(today);
	const flows = Array.from({ length: FLOW_MONTHS }, (_, index) => ({
		month: addMonths(thisMonth, index - FLOW_MONTHS + 1),
		inCents: 0,
		outCents: 0,
	}));
	const byMonth = new Map(flows.map((flow) => [flow.month, flow]));
	for (const row of rows) {
		const flow = byMonth.get(monthStartOf(row.day));
		const direction = directionOf(row);
		if (!flow || !countsInBalance(row) || direction === "transfer") {
			continue;
		}
		if (direction === "in") {
			flow.inCents += row.amountCents;
		} else {
			flow.outCents -= row.amountCents;
		}
	}
	return flows;
}

/** The end-of-day balance of one account, or of all three, for the last `days` days, oldest first. */
export function buildBalanceLine(
	balances: DailyBalance[],
	scope: BalanceScope,
	days: number,
): BalancePoint[] {
	return balances.slice(-days).map((balance) => ({
		day: balance.day,
		cents: scope === "all" ? balance.totalCents : balance.byAccount[scope],
	}));
}
