// The math of the home: the four KPI figures, the income sources, the spending split, and the monthly expenses.
// overview.queries.ts calls these functions with the rows of the sample ledger. They read no clock.
import {
	type Account,
	type AccountId,
	addDays,
	addMonths,
	type CategoryId,
	changeRatio,
	type DailyBalance,
	lastDays,
	monthStartOf,
	type Transaction,
} from "~/features/ledger";

/** One figure with its change against the period before. */
export type Figure = {
	/** In cents. */
	valueCents: number;
	/** Ratio against the period before: 0.12 is +12 %. null when the period before has no value. */
	change: number | null;
};

/** One category and its money in the period. */
export type CategoryAmount = {
	categoryId: CategoryId;
	/** In cents and positive. */
	amountCents: number;
};

/** Everything that the home shows for one period. */
export type OverviewSummary = {
	/** The first day of the period, as `YYYY-MM-DD`. */
	periodStart: string;
	/** The last day of the period: today, as `YYYY-MM-DD`. */
	periodEnd: string;
	/** Bank and cash accounts at the end of today. The change compares with the end of the day before the period. */
	cash: Figure;
	/** Income minus expenses of the period. Transfers do not count. */
	netProfit: Figure;
	/** Expenses of the period, positive. */
	expenses: Figure;
	/** What the cards owe today, positive. The change compares with the day before the period. */
	cardDebt: Figure;
	/** The sum of the credit limits of the cards, in cents. */
	cardLimitCents: number;
	/** What the cards owed at the end of each day of the period, oldest first, in cents. */
	cardDebtByDay: { day: string; debtCents: number }[];
	/** Income of the period, positive. */
	income: Figure;
	/** Income by category, the largest first. Categories with no income in the period are absent. */
	incomeSources: CategoryAmount[];
	/** Count of the income entries of the period. */
	incomeCount: number;
	/** Expenses by category, the largest first. Their sum is `expenses.valueCents`. */
	spending: CategoryAmount[];
};

// Income and expenses from `fromDay` to `toDay`, both included, in cents and both positive. Transfers do not count.
function flowBetween(rows: Transaction[], fromDay: string, toDay: string) {
	let incomeCents = 0;
	let expenseCents = 0;
	for (const row of rows) {
		// `YYYY-MM-DD` texts compare in date order.
		if (row.day < fromDay || row.day > toDay) {
			continue;
		}
		if (row.type === "income") {
			incomeCents += row.amountCents;
		} else if (row.type === "expense") {
			expenseCents -= row.amountCents;
		}
	}
	return { incomeCents, expenseCents };
}

// The sum of `type` entries per category in the period, the largest first, as positive cents.
function byCategory(
	rows: Transaction[],
	type: "income" | "expense",
): CategoryAmount[] {
	const amounts = new Map<CategoryId, number>();
	for (const row of rows) {
		if (row.type === type) {
			amounts.set(
				row.categoryId,
				(amounts.get(row.categoryId) ?? 0) + Math.abs(row.amountCents),
			);
		}
	}
	return [...amounts]
		.map(([categoryId, amountCents]) => ({ categoryId, amountCents }))
		.sort((first, second) => second.amountCents - first.amountCents);
}

// The balance at the end of `day`. 0 when the history has no such day.
function balanceOn(balances: DailyBalance[], day: string): number {
	return balances.find((point) => point.day === day)?.balanceCents ?? 0;
}

/**
 * The home figures of the last `days` days, today included. `rows` is every entry of the ledger.
 * `balances` holds the daily balance of every account. `today` is `YYYY-MM-DD`.
 */
export function buildOverviewSummary(
	rows: Transaction[],
	accounts: Account[],
	balances: Record<AccountId, DailyBalance[]>,
	today: string,
	days: number,
): OverviewSummary {
	const periodStart = addDays(today, 1 - days);
	const previousEnd = addDays(periodStart, -1);
	const previousStart = addDays(previousEnd, 1 - days);
	const current = flowBetween(rows, periodStart, today);
	const previous = flowBetween(rows, previousStart, previousEnd);
	const cards = accounts.filter((account) => account.type === "credit_card");
	// Cash is every account that is not a card.
	const cashOn = (day: string) =>
		accounts
			.filter((account) => account.type !== "credit_card")
			.reduce((sum, account) => sum + balanceOn(balances[account.id], day), 0);
	// A card balance is negative, so the debt is its opposite.
	const cardDebtOn = (day: string) =>
		cards.reduce(
			(sum, account) => sum - balanceOn(balances[account.id], day),
			0,
		);
	const periodRows = rows.filter(
		(row) => row.day >= periodStart && row.day <= today,
	);
	const netNow = current.incomeCents - current.expenseCents;
	const netBefore = previous.incomeCents - previous.expenseCents;
	return {
		periodStart,
		periodEnd: today,
		cash: {
			valueCents: cashOn(today),
			change: changeRatio(cashOn(today), cashOn(previousEnd)),
		},
		netProfit: { valueCents: netNow, change: changeRatio(netNow, netBefore) },
		expenses: {
			valueCents: current.expenseCents,
			change: changeRatio(current.expenseCents, previous.expenseCents),
		},
		cardDebt: {
			valueCents: cardDebtOn(today),
			change: changeRatio(cardDebtOn(today), cardDebtOn(previousEnd)),
		},
		cardLimitCents: cards.reduce(
			(sum, account) => sum + (account.creditLimitCents ?? 0),
			0,
		),
		cardDebtByDay: lastDays(today, days).map((day) => ({
			day,
			debtCents: cardDebtOn(day),
		})),
		income: {
			valueCents: current.incomeCents,
			change: changeRatio(current.incomeCents, previous.incomeCents),
		},
		incomeSources: byCategory(periodRows, "income"),
		incomeCount: periodRows.filter((row) => row.type === "income").length,
		spending: byCategory(periodRows, "expense"),
	};
}

/** The months of the monthly expenses chart: this month and the 5 before. */
export const EXPENSE_MONTHS = 6;

/** The expenses of one calendar month. */
export type MonthExpense = {
	/** The first day of the month, as `YYYY-MM-DD`. */
	monthStart: string;
	/** In cents and positive. The current month counts up to today. */
	expenseCents: number;
};

/** The expenses of this month and the 5 months before, the oldest first. `today` is `YYYY-MM-DD`. */
export function buildMonthlyExpenses(
	rows: Transaction[],
	today: string,
): MonthExpense[] {
	const currentMonth = monthStartOf(today);
	return Array.from({ length: EXPENSE_MONTHS }, (_, index) => {
		const monthStart = addMonths(currentMonth, index - EXPENSE_MONTHS + 1);
		return {
			monthStart,
			expenseCents: rows
				.filter(
					(row) =>
						row.type === "expense" && monthStartOf(row.day) === monthStart,
				)
				.reduce((sum, row) => sum - row.amountCents, 0),
		};
	});
}
