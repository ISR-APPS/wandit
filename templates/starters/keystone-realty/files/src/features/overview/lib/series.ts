// The math of the home: the four KPI figures, the performance series, the sources per month,
// the listing mix, and the sales progress. overview.queries.ts calls these pure functions with the sample rows.
// They read no clock of their own: each one takes `now`, so the figures of one load agree.
import {
	changeRatio,
	DAY_MS,
	dayNumberOf,
	isoDayOf,
	type LeadRow,
	type LeadSource,
	type ListingRow,
	type ViewingRow,
} from "~/features/agency";

/** The KPIs compare the state now with the state this many days ago. */
export const COMPARE_DAYS = 30;

/** One KPI figure of the home, before formatting. */
export type HomeKpi = {
	value: number;
	/** Ratio against the earlier value: 0.12 is +12 %. null when the earlier value is 0. */
	change: number | null;
};

/** The four KPIs of the home, in the order of the row. */
export type HomeKpis = {
	/** Leads that are still open: new, contacted, viewing, or offer. Compared with 30 days ago. */
	activeLeads: HomeKpi;
	/** Asking value of the homes on the market or under offer, in whole currency units. Compared with 30 days ago. */
	pipelineValue: HomeKpi;
	/** Homes on the market with no accepted offer. Compared with 30 days ago. */
	activeListings: HomeKpi;
	/** Sales completed since the first day of this quarter. Compared with the same count of days last quarter. */
	closedThisQuarter: HomeKpi;
};

const OPEN_LEAD_STATUSES = new Set(["new", "contacted", "viewing", "offer"]);
const IN_PIPELINE_STATUSES = new Set(["active", "under_offer"]);

function homeFigures(leads: LeadRow[], listings: ListingRow[]) {
	const inPipeline = listings.filter((listing) =>
		IN_PIPELINE_STATUSES.has(listing.status),
	);
	return {
		activeLeads: leads.filter((lead) => OPEN_LEAD_STATUSES.has(lead.status))
			.length,
		pipelineValue: inPipeline.reduce(
			(sum, listing) => sum + listing.askingPrice,
			0,
		),
		activeListings: listings.filter((listing) => listing.status === "active")
			.length,
	};
}

/** The first day of the calendar quarter of `ms`, at local midnight. */
export function quarterStartOf(ms: number): number {
	const date = new Date(ms);
	// A quarter is 3 months: January, April, July, and October start one.
	return new Date(
		date.getFullYear(),
		Math.floor(date.getMonth() / 3) * 3,
		1,
	).getTime();
}

/**
 * The KPIs of the home. `leadsBefore` and `listingsBefore` are the rows as they were 30 days ago.
 * The quarter compares the days of this quarter until now with the same count of days last quarter.
 */
export function buildHomeKpis(
	current: { leads: LeadRow[]; listings: ListingRow[] },
	before: { leads: LeadRow[]; listings: ListingRow[] },
	now: number,
): HomeKpis {
	const today = homeFigures(current.leads, current.listings);
	const earlier = homeFigures(before.leads, before.listings);
	const quarterStart = quarterStartOf(now);
	const previousQuarterStart = quarterStartOf(quarterStart - DAY_MS);
	const elapsed = now - quarterStart;
	const soldBetween = (start: number, end: number) =>
		current.listings.filter((listing) => {
			const soldAt =
				listing.soldAt === null ? Number.NaN : Date.parse(listing.soldAt);
			return soldAt >= start && soldAt < end;
		}).length;
	const closed = soldBetween(quarterStart, now);
	const closedBefore = soldBetween(
		previousQuarterStart,
		previousQuarterStart + elapsed,
	);
	return {
		activeLeads: {
			value: today.activeLeads,
			change: changeRatio(today.activeLeads, earlier.activeLeads),
		},
		pipelineValue: {
			value: today.pipelineValue,
			change: changeRatio(today.pipelineValue, earlier.pipelineValue),
		},
		activeListings: {
			value: today.activeListings,
			change: changeRatio(today.activeListings, earlier.activeListings),
		},
		closedThisQuarter: {
			value: closed,
			change: changeRatio(closed, closedBefore),
		},
	};
}

/** The scales of the performance chart: days, weeks, and blocks of 30 days. */
export const PERFORMANCE_SCALES = ["day", "week", "month"] as const;

/** One scale of the performance chart. */
export type PerformanceScale = (typeof PERFORMANCE_SCALES)[number];

// Points per scale and days per point. 5 blocks of 30 days stay inside the 180 days of sample history,
// after the first viewings of the sample data.
const SCALE_BUCKETS = {
	day: { count: 14, days: 1 },
	week: { count: 12, days: 7 },
	month: { count: 5, days: 30 },
} satisfies Record<PerformanceScale, { count: number; days: number }>;

/** One point of the performance chart, oldest first in a list. */
export type PerformancePoint = {
	/** The first day of the point, as YYYY-MM-DD. */
	start: string;
	/** The last day of the point, as YYYY-MM-DD. The same as `start` on the day scale. */
	end: string;
	/** Count of the leads that arrived in the point. */
	leads: number;
	/** Count of the viewings in the point that were not cancelled. */
	viewings: number;
};

/** The performance series of each scale. The last point ends yesterday: today is not over. */
export function buildPerformance(
	leads: LeadRow[],
	viewings: ViewingRow[],
	now: number,
): Record<PerformanceScale, PerformancePoint[]> {
	const today = dayNumberOf(now);
	const leadsByDay = countByDay(leads.map((lead) => lead.createdAt));
	const viewingsByDay = countByDay(
		viewings
			.filter((viewing) => viewing.status !== "cancelled")
			.map((viewing) => viewing.startsAt),
	);
	const sumDays = (counts: Map<number, number>, first: number, days: number) =>
		Array.from(
			{ length: days },
			(_, index) => counts.get(first + index) ?? 0,
		).reduce((sum, count) => sum + count, 0);
	const series = (scale: PerformanceScale): PerformancePoint[] => {
		const { count, days } = SCALE_BUCKETS[scale];
		return Array.from({ length: count }, (_, index) => {
			const first = today - (count - index) * days;
			return {
				start: isoDayOf(first),
				end: isoDayOf(first + days - 1),
				leads: sumDays(leadsByDay, first, days),
				viewings: sumDays(viewingsByDay, first, days),
			};
		});
	};
	return { day: series("day"), week: series("week"), month: series("month") };
}

function countByDay(times: string[]): Map<number, number> {
	const counts = new Map<number, number>();
	for (const time of times) {
		const day = dayNumberOf(Date.parse(time));
		counts.set(day, (counts.get(day) ?? 0) + 1);
	}
	return counts;
}

/** The parts of the source card: the 3 largest sources of the sample data, then the rest as "other". */
export const SOURCE_PARTS = ["portal", "website", "referral", "other"] as const;

/** One part of the source card. */
export type SourcePart = (typeof SOURCE_PARTS)[number];

// The source part of one lead: its own source for the 3 largest sources, else "other".
function sourcePartOf(source: LeadSource): SourcePart {
	return source === "portal" || source === "website" || source === "referral"
		? source
		: "other";
}

/** The new leads of one calendar month per source part. */
export type SourceMonth = {
	/** The first day of the month, as YYYY-MM-DD. It is also the value of the month select. */
	month: string;
	counts: Record<SourcePart, number>;
};

/** The leads per source part for this month and the 2 months before it, newest first. */
export function buildSourceMonths(
	leads: LeadRow[],
	now: number,
): SourceMonth[] {
	const date = new Date(now);
	return [0, 1, 2].map((monthsBack) => {
		const start = new Date(date.getFullYear(), date.getMonth() - monthsBack, 1);
		const end = new Date(
			date.getFullYear(),
			date.getMonth() - monthsBack + 1,
			1,
		);
		const counts: Record<SourcePart, number> = {
			portal: 0,
			website: 0,
			referral: 0,
			other: 0,
		};
		for (const lead of leads) {
			const createdAt = Date.parse(lead.createdAt);
			if (createdAt >= start.getTime() && createdAt < end.getTime()) {
				counts[sourcePartOf(lead.source)] += 1;
			}
		}
		return {
			month: isoDayOf(dayNumberOf(start.getTime())),
			counts,
		};
	});
}

/** The homes of the agency: on the market (coming soon, active, or under offer) and sold. Withdrawn homes are out. */
export type ListingMix = {
	onMarket: number;
	sold: number;
};

/** The counts of the listing overview card. */
export function buildListingMix(listings: ListingRow[]): ListingMix {
	return {
		onMarket: listings.filter(
			(listing) => listing.status !== "sold" && listing.status !== "withdrawn",
		).length,
		sold: listings.filter((listing) => listing.status === "sold").length,
	};
}

/** The sales progress card: the sales closed this quarter, and the homes under offer now. */
export type SalesProgress = {
	closed: number;
	inProgress: number;
};

/** `closed` is the same count as the "Closed this quarter" KPI. */
export function buildSalesProgress(
	listings: ListingRow[],
	closedThisQuarter: number,
): SalesProgress {
	return {
		closed: closedThisQuarter,
		inProgress: listings.filter((listing) => listing.status === "under_offer")
			.length,
	};
}
