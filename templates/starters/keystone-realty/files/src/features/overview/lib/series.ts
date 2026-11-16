// Shapes and math of the home data: the daily points of the trend and the KPI figures.
// overview.queries.ts builds both from the lead, viewing, and listing rows. The trend and figure panels take the types.
// changeRatio is the one change formula of the app, so every delta compares the same way.
import {
	dayNumberOf,
	isoDayOf,
	type LeadRow,
	type ListingRow,
	medianOf,
	REPORT_DAYS,
	reportEndOf,
	reportStartOf,
	timeOnDay,
	type ViewingRow,
} from "~/features/agency";
import type { TranslationKey } from "~/shared/i18n";

/** The period choices of the trend panel, in days. The sample data covers two periods of the longest one. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice, in days. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** One day of a trend, oldest first in a list. Zero on a day with no lead. */
export type DailyPoint = {
	/** The day as YYYY-MM-DD, in the time zone of the browser. */
	day: string;
	/** Count of the leads that arrived on the day. */
	current: number;
	/** Count of the same day one period earlier. */
	previous: number;
};

/** One KPI figure of the home. */
export type KpiItem = {
	/** Stable id, also the React key, for example "viewings-held". */
	id: string;
	/** Label, already translated. */
	label: string;
	value: number;
	/** Intl options of the value, for example { style: "unit", unit: "hour" }. A plain number when absent. */
	format?: Intl.NumberFormatOptions;
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null hides the delta. */
	change: number | null;
	/** "down" for delays: a fall is good news. */
	goodWhen: "up" | "down";
};

/** One KPI before translation. The home turns `labelKey` into the `label` of KpiItem with t(). */
export type OverviewKpi = Omit<KpiItem, "label"> & { labelKey: TranslationKey };

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

/** The leads per day for the last `days` whole days, with the same days one period earlier. Today is not over, so it is left out. */
export function buildDailyLeads(
	leads: LeadRow[],
	days: number,
	now: number,
): DailyPoint[] {
	const today = dayNumberOf(now);
	const countByDay = new Map<number, number>();
	for (const lead of leads) {
		const dayNumber = dayNumberOf(Date.parse(lead.createdAt));
		countByDay.set(dayNumber, (countByDay.get(dayNumber) ?? 0) + 1);
	}
	return Array.from({ length: days }, (_, index) => {
		const dayNumber = today - days + index;
		return {
			day: isoDayOf(dayNumber),
			current: countByDay.get(dayNumber) ?? 0,
			previous: countByDay.get(dayNumber - days) ?? 0,
		};
	});
}

/** The count of `times` (ISO texts, null for "not yet") from `start` (included) to `end` (excluded). */
function countBetween(
	times: (string | null)[],
	start: number,
	end: number,
): number {
	return times.filter((time) => {
		const ms = time === null ? Number.NaN : Date.parse(time);
		return ms >= start && ms < end;
	}).length;
}

/** The median hours to the first answer, for the leads that arrived from `start` to `end`. null with no answer. */
function medianAnswerHours(
	leads: LeadRow[],
	start: number,
	end: number,
): number | null {
	const minutes = leads.flatMap((lead) => {
		const createdAt = Date.parse(lead.createdAt);
		return lead.answerMinutes !== null && createdAt >= start && createdAt < end
			? [lead.answerMinutes]
			: [];
	});
	const median = medianOf(minutes);
	// 60 minutes in an hour.
	return median === null ? null : median / 60;
}

/** The KPIs of the home, the most important first: viewings held, the answer time, and the sales agreed. */
export function buildOverviewKpis(
	leads: LeadRow[],
	viewings: ViewingRow[],
	listings: ListingRow[],
	now: number,
): OverviewKpi[] {
	// This period is the 30 whole days before today. The previous period is the 30 days before it.
	const start = reportStartOf(now);
	const previousStart = timeOnDay(dayNumberOf(start) - REPORT_DAYS, 0);
	const end = reportEndOf(now);

	const heldTimes = viewings
		.filter((viewing) => viewing.status === "completed")
		.map((viewing) => viewing.startsAt);
	const offerTimes = listings.map((listing) => listing.offerAcceptedAt);
	const answerHours = medianAnswerHours(leads, start, end);
	const previousAnswerHours = medianAnswerHours(leads, previousStart, start);

	return [
		{
			id: "viewings-held",
			labelKey: "overview.kpis.viewingsHeld",
			value: countBetween(heldTimes, start, end),
			change: changeRatio(
				countBetween(heldTimes, start, end),
				countBetween(heldTimes, previousStart, start),
			),
			goodWhen: "up",
		},
		{
			id: "answer-time",
			labelKey: "overview.kpis.answerTime",
			value: answerHours ?? 0,
			format: {
				style: "unit",
				unit: "hour",
				unitDisplay: "short",
				maximumFractionDigits: 1,
			},
			change:
				answerHours === null || previousAnswerHours === null
					? null
					: changeRatio(answerHours, previousAnswerHours),
			goodWhen: "down",
		},
		{
			id: "sales-agreed",
			labelKey: "overview.kpis.salesAgreed",
			value: countBetween(offerTimes, start, end),
			change: changeRatio(
				countBetween(offerTimes, start, end),
				countBetween(offerTimes, previousStart, start),
			),
			goodWhen: "up",
		},
	];
}
