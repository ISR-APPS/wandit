// The math of the home figures: the five totals and the daily money in and out.
// overview.queries.ts calls these functions with the rows of the sample ledger. They read no clock.
import {
	type Account,
	type AccountId,
	addDays,
	changeRatio,
	type DailyBalance,
	lastDays,
	type Transaction,
} from "~/features/ledger";
import type { TranslationKey } from "~/shared/i18n";
import type { CategoryPoint, KpiItem } from "./series";

/** The totals compare the last 30 days with the 30 days before. */
export const KPI_PERIOD_DAYS = 30;

/** One KPI before translation. The home turns `labelKey` into the `label` of KpiItem with t(). */
export type OverviewKpi = Omit<KpiItem, "label"> & { labelKey: TranslationKey };

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

// The balance at the end of `day`. 0 when the history has no such day.
function balanceOn(balances: DailyBalance[], day: string): number {
	return balances.find((point) => point.day === day)?.balanceCents ?? 0;
}

/**
 * The 5 figures of the home, the most important first.
 * `today` is `YYYY-MM-DD`. `balances` holds the daily balance of every account for the 90 days of the history.
 */
export function buildOverviewKpis(
	rows: Transaction[],
	accounts: Account[],
	balances: Record<AccountId, DailyBalance[]>,
	today: string,
): OverviewKpi[] {
	const periodStart = addDays(today, 1 - KPI_PERIOD_DAYS);
	const previousEnd = addDays(periodStart, -1);
	const previousStart = addDays(previousEnd, 1 - KPI_PERIOD_DAYS);
	const current = flowBetween(rows, periodStart, today);
	const previous = flowBetween(rows, previousStart, previousEnd);
	// Cash is every account that is not a card. The card balance is negative, so the debt is its opposite.
	const cashOn = (day: string) =>
		accounts
			.filter((account) => account.type !== "credit_card")
			.reduce((sum, account) => sum + balanceOn(balances[account.id], day), 0);
	const cardDebtOn = (day: string) =>
		accounts
			.filter((account) => account.type === "credit_card")
			.reduce((sum, account) => sum - balanceOn(balances[account.id], day), 0);
	return [
		{
			id: "income",
			labelKey: "metrics.income",
			value: current.incomeCents,
			change: changeRatio(current.incomeCents, previous.incomeCents),
			goodWhen: "up",
		},
		{
			id: "expenses",
			labelKey: "metrics.expenses",
			value: current.expenseCents,
			change: changeRatio(current.expenseCents, previous.expenseCents),
			goodWhen: "down",
		},
		{
			id: "net",
			labelKey: "metrics.net",
			value: current.incomeCents - current.expenseCents,
			change: changeRatio(
				current.incomeCents - current.expenseCents,
				previous.incomeCents - previous.expenseCents,
			),
			goodWhen: "up",
		},
		{
			id: "cash-on-hand",
			labelKey: "metrics.cashOnHand",
			value: cashOn(today),
			change: changeRatio(cashOn(today), cashOn(previousEnd)),
			goodWhen: "up",
		},
		{
			id: "card-debt",
			labelKey: "metrics.cardDebt",
			value: cardDebtOn(today),
			change: changeRatio(cardDebtOn(today), cardDebtOn(previousEnd)),
			goodWhen: "down",
		},
	];
}

/** Money in and money out for each of the last `days` days, oldest first: two rows per day, in cents. */
export function buildDailyCashFlow(
	rows: Transaction[],
	today: string,
	days: number,
): CategoryPoint[] {
	return lastDays(today, days).flatMap((day) => {
		const { incomeCents, expenseCents } = flowBetween(rows, day, day);
		return [
			{ day, category: "moneyIn", value: incomeCents },
			{ day, category: "moneyOut", value: expenseCents },
		] satisfies CategoryPoint[];
	});
}
