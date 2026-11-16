// The math of the home: the four totals and the daily balance series of the strip.
// overview.queries.ts calls these pure functions with the sample rows. A later version runs the same math in SQL.
import {
	changeRatio,
	countsInBalance,
	type DailyBalance,
	type DailyPoint,
	daysBetween,
	directionOf,
	type KpiItem,
	type Transaction,
} from "~/features/bank";
import type { TranslationKey } from "~/shared/i18n";

// The window of the totals, in days. The delta compares with the same number of days just before.
const KPI_WINDOW_DAYS = 30;

/** One KPI before translation. The home turns `labelKey` into the `label` of KpiItem with t(). */
export type OverviewKpi = Omit<KpiItem, "label"> & { labelKey: TranslationKey };

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

/**
 * The four totals of the home, the most important first. Money out and card spend are positive cents.
 * Transfers between the accounts are not money in or money out: they stay inside the business.
 */
export function buildOverviewKpis(
	rows: Transaction[],
	balances: DailyBalance[],
	today: string,
): OverviewKpi[] {
	const window = KPI_WINDOW_DAYS;
	const current = (keep: (row: Transaction) => boolean) =>
		sumByAge(rows, today, 0, window - 1, keep);
	const previous = (keep: (row: Transaction) => boolean) =>
		sumByAge(rows, today, window, window * 2 - 1, keep);
	const isIn = (row: Transaction) => directionOf(row) === "in";
	const isOut = (row: Transaction) => directionOf(row) === "out";
	const isCard = (row: Transaction) => row.method === "card";

	const balanceToday = balances.at(-1)?.totalCents ?? 0;
	// The first point of the 30-day strip. The strip "From" value and this delta then use the same day.
	const balanceBefore = balances.at(-window)?.totalCents ?? 0;
	return [
		{
			id: "balance",
			labelKey: "overview.kpis.balance",
			value: balanceToday,
			change: changeRatio(balanceToday, balanceBefore),
			goodWhen: "up",
		},
		{
			id: "money-in",
			labelKey: "overview.kpis.moneyIn",
			value: current(isIn),
			change: changeRatio(current(isIn), previous(isIn)),
			goodWhen: "up",
		},
		{
			id: "money-out",
			labelKey: "overview.kpis.moneyOut",
			value: Math.abs(current(isOut)),
			change: changeRatio(Math.abs(current(isOut)), Math.abs(previous(isOut))),
			goodWhen: "down",
		},
		{
			id: "card-spend",
			labelKey: "overview.kpis.cardSpend",
			value: Math.abs(current(isCard)),
			change: changeRatio(
				Math.abs(current(isCard)),
				Math.abs(previous(isCard)),
			),
			goodWhen: "down",
		},
	];
}

/** The total balance at the end of each of the last `days` days, with the same day one period earlier. */
export function buildBalancePoints(
	balances: DailyBalance[],
	days: number,
): DailyPoint[] {
	return balances.slice(-days).map((balance, index) => ({
		day: balance.day,
		current: balance.totalCents,
		// The history holds HISTORY_DAYS days, more than twice the longest period, so this index exists.
		previous: balances[balances.length - days * 2 + index]?.totalCents ?? 0,
	}));
}
