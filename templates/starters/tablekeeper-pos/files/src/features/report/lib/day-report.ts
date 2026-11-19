// The math of the day report: the figures, the hours, the payments, the categories, and the serve times.
// dayReportQueryOptions calls buildDayReport with the checks of the day. The report cards read its parts.
// Every money part counts the same lines as the home and the menu, so each part adds up to the gross sales.
import {
	changeRatio,
	isCountedOrder,
	lineTotalCents,
	MENU_CATEGORIES,
	type MenuCategory,
	type Order,
	orderSubtotalCents,
	type PaymentMethod,
	type TodayTotals,
	totalsOfToday,
} from "~/features/restaurant";

/** One clock hour of the day. A till reports a sale when it is taken: a paid check in the hour of its payment. */
export type HourPoint = {
	/** ISO time of the start of the hour, in the browser time zone. */
	hourStart: string;
	/** Sales of the kitchen lines in this hour, in cents, VAT included. */
	kitchenCents: number;
	/** Sales of the bar lines in this hour, in cents, VAT included. */
	barCents: number;
	/** The checks that count in this hour. Voids excluded. */
	checks: number;
	/** The guests of these checks. */
	covers: number;
};

/** One figure card of the first band. Its label is the message key `report.<id>`. */
export type ReportFigure = {
	id: "grossSales" | "checks" | "averageCheck";
	/** Cents for the money figures, a count for the checks. */
	value: number;
	isMoney: boolean;
	/** Ratio against the same weekday last week at this time: 0.12 is +12 %. null with no week to compare. */
	change: number | null;
};

/** One slice of the payments donut. "open" is the checks that are still on the floor. */
export type PaymentRow = {
	method: PaymentMethod | "open";
	checks: number;
	/** Sales of these checks in cents, tips excluded. The 3 rows add up to the gross sales. */
	salesCents: number;
};

/** Sales of one menu category. */
export type CategoryRow = {
	category: MenuCategory;
	/** Portions sold. */
	quantity: number;
	salesCents: number;
};

/** The 5 serve-time ranges, in minutes from "sent to the kitchen" to "served". Labels: `report.serveBuckets.<id>`. */
export const SERVE_BUCKETS = [
	{ id: "under10", maxMinutes: 10 },
	{ id: "from10to15", maxMinutes: 15 },
	{ id: "from15to20", maxMinutes: 20 },
	{ id: "from20to30", maxMinutes: 30 },
	{ id: "over30", maxMinutes: Number.POSITIVE_INFINITY },
] as const;

/** The checks that reached the table in one serve-time range. */
export type ServeBucket = {
	id: (typeof SERVE_BUCKETS)[number]["id"];
	checks: number;
};

/** The kitchen speed of the day: the time from "sent" to "served" on each served check. */
export type ServeTimes = {
	/** Average in whole minutes. null before the first served check. */
	averageMinutes: number | null;
	/** The 5 ranges, the fastest first. They add up to the served checks. */
	buckets: ServeBucket[];
	/** The served check with the shortest time, and that time in whole minutes. null before the first served check. */
	fastest: { order: Order; minutes: number } | null;
};

/** Everything that the day report shows. All amounts are whole cents. */
export type DayReport = {
	/** ISO time when the first check of the day opened. null before the first check. */
	openedAt: string | null;
	/** The 3 figure cards: gross sales, checks, and the average check. */
	figures: ReportFigure[];
	grossCents: number;
	covers: number;
	/** Covers against the same weekday last week at this time, as a ratio. null with no week to compare. */
	coversChange: number | null;
	/** One point per clock hour from the first check, oldest first. */
	hours: HourPoint[];
	payments: PaymentRow[];
	/** Every category in menu order, with zero rows kept. */
	categories: CategoryRow[];
	serveTimes: ServeTimes;
};

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/**
 * The report of the business day so far. `orders` are the checks of the day, newest first.
 * `lastWeek` is the same weekday last week at this time (sameTimeLastWeek). `now` is milliseconds since 1970.
 */
export function buildDayReport(
	orders: Order[],
	lastWeek: TodayTotals | undefined,
	now: number,
): DayReport {
	const counted = orders.filter(isCountedOrder);
	const today = totalsOfToday(orders);
	const compare = (current: number, previous: number | undefined) =>
		previous === undefined ? null : changeRatio(current, previous);
	const averageCents =
		today.checks === 0 ? 0 : Math.round(today.salesCents / today.checks);
	const lastWeekAverage =
		lastWeek && lastWeek.checks > 0
			? lastWeek.salesCents / lastWeek.checks
			: undefined;

	const firstOrder = orders.at(-1);
	return {
		openedAt: firstOrder?.openedAt ?? null,
		figures: [
			{
				id: "grossSales",
				value: today.salesCents,
				isMoney: true,
				change: compare(today.salesCents, lastWeek?.salesCents),
			},
			{
				id: "checks",
				value: today.checks,
				isMoney: false,
				change: compare(today.checks, lastWeek?.checks),
			},
			{
				id: "averageCheck",
				value: averageCents,
				isMoney: true,
				change: compare(averageCents, lastWeekAverage),
			},
		],
		grossCents: today.salesCents,
		covers: today.covers,
		coversChange: compare(today.covers, lastWeek?.covers),
		hours: firstOrder ? buildHours(counted, firstOrder.openedAt, now) : [],
		payments: buildPayments(counted),
		categories: buildCategories(counted),
		serveTimes: buildServeTimes(counted),
	};
}

/** The hour with the highest sales. undefined while no hour has a sale. */
export function busiestHour(hours: HourPoint[]): HourPoint | undefined {
	return hours.reduce<HourPoint | undefined>((best, point) => {
		const sales = point.kitchenCents + point.barCents;
		if (sales === 0) {
			return best;
		}
		return best === undefined || sales > best.kitchenCents + best.barCents
			? point
			: best;
	}, undefined);
}

// One point per clock hour from the hour of the first check to the last sale. A quiet hour shows 0.
// The hours add up to the gross sales: each counted check falls in exactly one hour.
function buildHours(
	counted: Order[],
	firstOpenedAt: string,
	now: number,
): HourPoint[] {
	const saleTime = (order: Order) => Date.parse(order.paidAt ?? order.openedAt);
	// An open check runs until now. After the last payment of a closed day, the chart stops at that payment.
	const end = counted.some((order) => order.paidAt === null)
		? now
		: Math.max(...counted.map(saleTime));
	const start = new Date(firstOpenedAt);
	start.setMinutes(0, 0, 0);
	const hours: HourPoint[] = [];
	for (let hour = start.getTime(); hour <= end; hour += HOUR_MS) {
		const inHour = counted.filter((order) => {
			const time = saleTime(order);
			return time >= hour && time < hour + HOUR_MS;
		});
		const lines = inHour.flatMap((order) => order.lines);
		const stationCents = (station: "kitchen" | "bar") =>
			lines
				.filter((line) => line.station === station)
				.reduce((sum, line) => sum + lineTotalCents(line), 0);
		hours.push({
			hourStart: new Date(hour).toISOString(),
			kitchenCents: stationCents("kitchen"),
			barCents: stationCents("bar"),
			checks: inHour.length,
			covers: inHour.reduce((sum, order) => sum + order.covers, 0),
		});
	}
	return hours;
}

// Card, cash, then the open checks. Each row counts the sales without tips.
function buildPayments(counted: Order[]): PaymentRow[] {
	const methods: PaymentRow["method"][] = ["card", "cash", "open"];
	return methods.map((method) => {
		const matching = counted.filter((order) =>
			method === "open" ? order.payment === null : order.payment === method,
		);
		return {
			method,
			checks: matching.length,
			salesCents: matching.reduce(
				(sum, order) => sum + orderSubtotalCents(order),
				0,
			),
		};
	});
}

// Portions and sales per category, in the order of the printed menu.
function buildCategories(counted: Order[]): CategoryRow[] {
	const lines = counted.flatMap((order) => order.lines);
	return MENU_CATEGORIES.map((category) => {
		const inCategory = lines.filter((line) => line.category === category);
		return {
			category,
			quantity: inCategory.reduce((sum, line) => sum + line.quantity, 0),
			salesCents: inCategory.reduce(
				(sum, line) => sum + lineTotalCents(line),
				0,
			),
		};
	});
}

// Only a served check has a serve time: the kitchen still works on the others.
function buildServeTimes(counted: Order[]): ServeTimes {
	const served = counted.flatMap((order) =>
		order.servedAt === null
			? []
			: [
					{
						order,
						minutes: Math.round(
							(Date.parse(order.servedAt) - Date.parse(order.sentAt)) /
								MINUTE_MS,
						),
					},
				],
	);
	// A check falls in the first range whose upper limit is above its time.
	const buckets = SERVE_BUCKETS.map((bucket, index) => {
		// The first range starts at 0. Each other range starts at the limit of the range before it.
		const minMinutes = SERVE_BUCKETS[index - 1]?.maxMinutes ?? 0;
		return {
			id: bucket.id,
			checks: served.filter(
				(entry) =>
					entry.minutes >= minMinutes && entry.minutes < bucket.maxMinutes,
			).length,
		};
	});
	const fastest = served.reduce<ServeTimes["fastest"]>(
		(best, entry) =>
			best === null || entry.minutes < best.minutes ? entry : best,
		null,
	);
	return {
		averageMinutes:
			served.length === 0
				? null
				: Math.round(
						served.reduce((sum, entry) => sum + entry.minutes, 0) /
							served.length,
					),
		buckets,
		fastest,
	};
}
