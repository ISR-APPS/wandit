import {
	type AdminAnalyticsDevice,
	type AdminAnalyticsQuery,
	type AdminOverviewQuery,
	type AdminOverviewRange,
	adminAnalyticsQuerySchema,
	adminOverviewQuerySchema,
} from "@wandit/contracts";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 86_400_000;
const LONG_RANGE_THRESHOLD_DAYS = 90;
const MAX_MONTH_TICKS = 7;

export const adminDateRangeLabels = {
	"7d": "Last 7 days",
	"30d": "Last 30 days",
	"90d": "Last 90 days",
	"180d": "Last 6 months",
	"365d": "Last year",
	custom: "Custom range",
} satisfies Record<AdminOverviewRange, string>;

export const adminDateRangeOptions = [
	"7d",
	"30d",
	"90d",
	"180d",
	"365d",
	"custom",
] as const satisfies readonly AdminOverviewRange[];

export type AdminDateRangeQuery = AdminOverviewQuery;

type AdminDateRangeSearchInput = {
	range?: AdminOverviewRange;
	from?: string;
	to?: string;
};

type AdminAnalyticsFilterSearchInput = {
	source?: string;
	country?: string;
	device?: AdminAnalyticsDevice;
	cohortOnly?: boolean;
};

type AdminAnalyticsSearchInput = AdminDateRangeSearchInput &
	AdminAnalyticsFilterSearchInput;

export type AdminDashboardSearch = AdminOverviewQuery &
	Pick<AdminAnalyticsQuery, "source" | "country" | "device">;

export type AdminCalendarDateRange = {
	from: Date | undefined;
	to?: Date;
};

export type AdminDateAxis = {
	granularity: "day" | "month";
	includeYear: boolean;
	ticks?: string[];
};

const defaultAdminDateRangeQuery: AdminDateRangeQuery = { range: "30d" };

function normalizeParsedQuery(query: AdminDateRangeQuery): AdminDateRangeQuery {
	if (query.range === "custom") {
		return {
			range: "custom",
			from: query.from,
			to: query.to,
		};
	}

	return { range: query.range };
}

function parseAdminDateRangeSearch(
	search: Record<string, unknown>,
): AdminDateRangeQuery {
	const candidate =
		search.range === "custom"
			? { range: search.range, from: search.from, to: search.to }
			: { range: search.range };
	const result = adminOverviewQuerySchema.safeParse(candidate);

	return result.success
		? normalizeParsedQuery(result.data)
		: { ...defaultAdminDateRangeQuery };
}

export function parseAdminOverviewSearch(
	search: Record<string, unknown>,
): AdminOverviewQuery {
	return parseAdminDateRangeSearch(search);
}

type AdminAnalyticsFilterKey = "source" | "country" | "device";

function parseAdminAnalyticsFilter<K extends AdminAnalyticsFilterKey>(
	dateQuery: AdminDateRangeQuery,
	key: K,
	value: unknown,
): AdminAnalyticsQuery[K] | undefined {
	if (value === undefined) return undefined;

	const result = adminAnalyticsQuerySchema.safeParse({
		...dateQuery,
		[key]: value,
	});

	return result.success ? result.data[key] : undefined;
}

export function parseAdminAnalyticsSearch(
	search: Record<string, unknown>,
): AdminAnalyticsQuery {
	const dateQuery = parseAdminDateRangeSearch(search);
	const source = parseAdminAnalyticsFilter(dateQuery, "source", search.source);
	const country = parseAdminAnalyticsFilter(
		dateQuery,
		"country",
		search.country,
	);
	const device = parseAdminAnalyticsFilter(dateQuery, "device", search.device);
	const cohortResult = adminAnalyticsQuerySchema.safeParse({
		...dateQuery,
		cohortOnly: search.cohortOnly,
	});

	return {
		...dateQuery,
		...(source ? { source } : {}),
		...(country ? { country } : {}),
		...(device ? { device } : {}),
		cohortOnly: cohortResult.success ? cohortResult.data.cohortOnly : false,
	};
}

export function parseAdminStandardAnalyticsSearch(
	search: Record<string, unknown>,
): AdminAnalyticsQuery {
	return {
		...parseAdminAnalyticsSearch(search),
		cohortOnly: false,
	};
}

export function parseAdminDashboardSearch(
	search: Record<string, unknown>,
): AdminDashboardSearch {
	const { cohortOnly: _cohortOnly, ...dashboardSearch } =
		parseAdminAnalyticsSearch(search);

	return dashboardSearch;
}

function isSearchRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const adminOverviewSearchValidator = {
	types: {} as {
		input: AdminDateRangeSearchInput;
		output: AdminOverviewQuery;
	},
	parse: (input: unknown) =>
		parseAdminOverviewSearch(isSearchRecord(input) ? input : {}),
};

export const adminAnalyticsSearchValidator = {
	types: {} as {
		input: AdminAnalyticsSearchInput;
		output: AdminAnalyticsQuery;
	},
	parse: (input: unknown) =>
		parseAdminAnalyticsSearch(isSearchRecord(input) ? input : {}),
};

export const adminStandardAnalyticsSearchValidator = {
	types: {} as {
		input: AdminAnalyticsSearchInput;
		output: AdminAnalyticsQuery;
	},
	parse: (input: unknown) =>
		parseAdminStandardAnalyticsSearch(isSearchRecord(input) ? input : {}),
};

export const adminDashboardSearchValidator = {
	types: {} as {
		input: AdminDateRangeSearchInput &
			Omit<AdminAnalyticsFilterSearchInput, "cohortOnly">;
		output: AdminDashboardSearch;
	},
	parse: (input: unknown) =>
		parseAdminDashboardSearch(isSearchRecord(input) ? input : {}),
};

function commonAnalyticsFilters(
	query: Pick<AdminAnalyticsQuery, "source" | "country" | "device">,
) {
	return {
		...(query.source ? { source: query.source } : {}),
		...(query.country ? { country: query.country } : {}),
		...(query.device ? { device: query.device } : {}),
	};
}

export function mergeAdminAnalyticsDateRangeQuery(
	query: AdminAnalyticsQuery,
	dateQuery: AdminDateRangeQuery,
	preserveCohortOnly = false,
): AdminAnalyticsQuery {
	return {
		...normalizeParsedQuery(dateQuery),
		...commonAnalyticsFilters(query),
		cohortOnly: preserveCohortOnly ? query.cohortOnly : false,
	};
}

export function mergeAdminDashboardDateRangeQuery(
	query: AdminDashboardSearch,
	dateQuery: AdminDateRangeQuery,
): AdminDashboardSearch {
	return {
		...normalizeParsedQuery(dateQuery),
		...commonAnalyticsFilters(query),
	};
}

export function getAdminOverviewQuery(
	query: AdminDateRangeQuery,
): AdminOverviewQuery {
	return normalizeParsedQuery(query);
}

function isAnalyticsNavigationPath(pathname: string): boolean {
	return pathname === "/dashboard" || pathname.startsWith("/analytics/");
}

export function getAdminAnalyticsNavigationSearch(
	pathname: string,
	targetPathname: string,
	search: Record<string, unknown>,
): AdminDashboardSearch | AdminAnalyticsQuery | undefined {
	if (
		!isAnalyticsNavigationPath(pathname) ||
		!isAnalyticsNavigationPath(targetPathname)
	) {
		return undefined;
	}

	if (
		pathname === "/analytics/engagement" &&
		targetPathname === "/analytics/engagement"
	) {
		return parseAdminAnalyticsSearch(search);
	}

	return parseAdminDashboardSearch(search);
}

function getIsoDateParts(value: string) {
	const match = ISO_DATE_PATTERN.exec(value);
	if (!match) return null;

	return {
		year: Number(match[1]),
		month: Number(match[2]),
		day: Number(match[3]),
	};
}

export function parseAdminCalendarDate(value: string): Date | undefined {
	const parts = getIsoDateParts(value);
	if (!parts) return undefined;

	const date = new Date(parts.year, parts.month - 1, parts.day);
	if (
		date.getFullYear() !== parts.year ||
		date.getMonth() !== parts.month - 1 ||
		date.getDate() !== parts.day
	) {
		return undefined;
	}

	return date;
}

export function serializeAdminCalendarDate(date: Date): string {
	const year = String(date.getFullYear()).padStart(4, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");

	return `${year}-${month}-${day}`;
}

export function parseAdminDateToUtcMilliseconds(
	value: string,
): number | undefined {
	const parts = getIsoDateParts(value);
	if (!parts) return undefined;

	const milliseconds = Date.UTC(parts.year, parts.month - 1, parts.day);
	const date = new Date(milliseconds);
	if (
		date.getUTCFullYear() !== parts.year ||
		date.getUTCMonth() !== parts.month - 1 ||
		date.getUTCDate() !== parts.day
	) {
		return undefined;
	}

	return milliseconds;
}

export function getUtcTodayAsLocalCalendarDate(now = new Date()): Date {
	return new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function getAdminInclusiveDateCount(
	from: string,
	to: string,
): number | undefined {
	const fromMilliseconds = parseAdminDateToUtcMilliseconds(from);
	const toMilliseconds = parseAdminDateToUtcMilliseconds(to);
	if (fromMilliseconds === undefined || toMilliseconds === undefined) {
		return undefined;
	}

	return (toMilliseconds - fromMilliseconds) / MILLISECONDS_PER_DAY + 1;
}

export function getAdminCalendarRange(
	query: AdminDateRangeQuery,
): AdminCalendarDateRange | undefined {
	if (query.range !== "custom" || !query.from || !query.to) {
		return undefined;
	}

	const from = parseAdminCalendarDate(query.from);
	const to = parseAdminCalendarDate(query.to);
	if (!from || !to) return undefined;

	return { from, to };
}

export function createAdminCustomDateRangeQuery(
	range: AdminCalendarDateRange | undefined,
): AdminDateRangeQuery | undefined {
	if (!range?.from || !range.to) return undefined;

	const result = adminOverviewQuerySchema.safeParse({
		range: "custom",
		from: serializeAdminCalendarDate(range.from),
		to: serializeAdminCalendarDate(range.to),
	});

	return result.success ? normalizeParsedQuery(result.data) : undefined;
}

function formatCalendarDatePart(date: Date, locale: string) {
	return {
		day: String(date.getDate()).padStart(2, "0"),
		month: new Intl.DateTimeFormat(locale, { month: "short" }).format(date),
		year: String(date.getFullYear()),
	};
}

export function formatAdminDateRangeLabel(
	query: AdminDateRangeQuery,
	locale = "en-US",
): string {
	if (query.range !== "custom") {
		return adminDateRangeLabels[query.range];
	}

	const range = getAdminCalendarRange(query);
	if (!range?.from || !range.to) return adminDateRangeLabels.custom;

	const from = formatCalendarDatePart(range.from, locale);
	const to = formatCalendarDatePart(range.to, locale);
	if (
		serializeAdminCalendarDate(range.from) ===
		serializeAdminCalendarDate(range.to)
	) {
		return `${from.day} ${from.month} ${from.year}`;
	}

	if (from.year === to.year) {
		return `${from.day} ${from.month} – ${to.day} ${to.month} ${to.year}`;
	}

	return `${from.day} ${from.month} ${from.year} – ${to.day} ${to.month} ${to.year}`;
}

function getValidSortedDates(values: readonly string[]): string[] {
	return [...new Set(values)]
		.filter((value) => parseAdminDateToUtcMilliseconds(value) !== undefined)
		.sort((left, right) => left.localeCompare(right));
}

export function getAdminDateAxis(values: readonly string[]): AdminDateAxis {
	const dates = getValidSortedDates(values);
	const first = dates[0];
	const last = dates.at(-1);
	if (!first || !last) {
		return { granularity: "day", includeYear: false };
	}

	const inclusiveDates = getAdminInclusiveDateCount(first, last);
	if (!inclusiveDates || inclusiveDates <= LONG_RANGE_THRESHOLD_DAYS) {
		return { granularity: "day", includeYear: false };
	}

	const firstDateInEachMonth = new Map<string, string>();
	for (const date of dates) {
		const month = date.slice(0, 7);
		if (!firstDateInEachMonth.has(month)) {
			firstDateInEachMonth.set(month, date);
		}
	}

	const monthlyDates = [...firstDateInEachMonth.values()];
	const step = Math.max(1, Math.ceil(monthlyDates.length / MAX_MONTH_TICKS));
	const ticks = monthlyDates.filter((_, index) => index % step === 0);
	const finalMonthlyDate = monthlyDates.at(-1);
	if (finalMonthlyDate && !ticks.includes(finalMonthlyDate)) {
		if (ticks.length < MAX_MONTH_TICKS) {
			ticks.push(finalMonthlyDate);
		} else {
			ticks[ticks.length - 1] = finalMonthlyDate;
		}
	}

	return {
		granularity: "month",
		includeYear: first.slice(0, 4) !== last.slice(0, 4),
		ticks,
	};
}

function formatUtcDate(value: string, locale: string) {
	const milliseconds = parseAdminDateToUtcMilliseconds(value);
	if (milliseconds === undefined) return null;

	const date = new Date(milliseconds);
	return {
		day: String(date.getUTCDate()).padStart(2, "0"),
		month: new Intl.DateTimeFormat(locale, {
			month: "short",
			timeZone: "UTC",
		}).format(date),
		year: String(date.getUTCFullYear()),
	};
}

export function formatAdminDateAxisTick(
	value: string,
	axis: Pick<AdminDateAxis, "granularity" | "includeYear">,
	locale = "en-US",
): string {
	const date = formatUtcDate(value, locale);
	if (!date) return value;

	if (axis.granularity === "month") {
		return axis.includeYear
			? `${date.month} ${date.year.slice(-2)}`
			: date.month;
	}

	return `${date.day} ${date.month}`;
}

export function formatAdminDateTooltipLabel(
	value: string,
	locale = "en-US",
): string {
	const date = formatUtcDate(value, locale);

	return date ? `${date.day} ${date.month} ${date.year}` : value;
}
