// The totals of the past business days: checks, covers, and sales per day, for the last 90 days.
// It stands in for a SQL read function that groups the `orders` table by day.
// The floor heat calendar and the "same day last week" figures read it. Today comes from the orders, not from here.
// Each past day scales the whole planned day of sample-orders.ts by its weekday, a trend, and some noise.
import { businessDay } from "./sample-orders";
import { createSeededRandom } from "./seeded-random";

/** The totals of one past business day. */
export type DailyTotals = {
	/** The local day, YYYY-MM-DD. */
	day: string;
	/** Checks that were not voided. */
	checks: number;
	covers: number;
	/** Sales in cents, VAT included, tips excluded. */
	salesCents: number;
};

/** Totals of one day with no date: today so far, or the whole planned day that the history scales from. */
export type TodayTotals = Omit<DailyTotals, "day">;

// 90 days feed the longest period of the heat calendar.
const HISTORY_DAYS = 90;
const HISTORY_SEED = 4417;

// Business per weekday against the week average, Sunday first (the order of getDay).
// Monday is the quietest day; Friday and Saturday are the busiest.
const WEEKDAY_RHYTHM = [0.95, 0.5, 0.6, 0.75, 0.88, 1.2, 1.32] as const;

/**
 * The totals of the `HISTORY_DAYS` days before the business day of `now` (milliseconds since 1970), oldest first.
 * `today` is the whole planned day of today, so a past day on the same weekday has about the same size.
 * A slow growth of about 9 % over 90 days and a noise of ±8 % make the series look real.
 */
export function listDailyHistory(
	now: number,
	today: TodayTotals,
): DailyTotals[] {
	const random = createSeededRandom(HISTORY_SEED);
	const todayStart = businessDay(now).start;
	const todayRhythm = WEEKDAY_RHYTHM[new Date(todayStart).getDay()] ?? 1;
	const coversPerCheck = today.checks === 0 ? 2.8 : today.covers / today.checks;
	const centsPerCover =
		today.covers === 0 ? 3600 : today.salesCents / today.covers;

	const history: DailyTotals[] = [];
	for (let offset = HISTORY_DAYS; offset >= 1; offset -= 1) {
		const date = new Date(todayStart);
		// setDate moves the calendar day, so a clock change does not shift midnight.
		date.setDate(date.getDate() - offset);
		const rhythm = WEEKDAY_RHYTHM[date.getDay()] ?? 1;
		const growth = 1 - (offset / HISTORY_DAYS) * 0.09;
		const noise = 0.92 + random() * 0.16;
		const checks = Math.round(
			(today.checks * rhythm * growth * noise) / todayRhythm,
		);
		const covers = Math.round(
			checks * coversPerCheck * (0.95 + random() * 0.1),
		);
		const salesCents =
			Math.round((covers * centsPerCover * (0.94 + random() * 0.12)) / 100) *
			100;
		history.push({ day: toIsoDay(date), checks, covers, salesCents });
	}
	return history;
}

/** The local day of `date` as YYYY-MM-DD. */
export function toIsoDay(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}
