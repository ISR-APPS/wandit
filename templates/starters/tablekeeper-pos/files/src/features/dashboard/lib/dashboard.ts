// The math of the sales home: the daily sales of the period, the 4 stat cards, the best sellers, and the check steps.
// dashboard.queries.ts calls the build functions. The cards of DashboardPage read the types.
// Every figure counts the same checks as the orders list and the day report, so the numbers agree.
import {
	changeRatio,
	type DailyTotals,
	type FloorTable,
	guestsAt,
	isCountedOrder,
	type MenuCategory,
	type Order,
	type OrderStatus,
	type TodayTotals,
	toIsoDay,
} from "~/features/restaurant";
import type { Dictionary, TranslationKey } from "~/shared/i18n";

/** The period choices of the page header, in days. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** The period of a first visit: about one month, as the kit chart. */
export const DEFAULT_DAYS: PeriodDays = 30;

/** One bar of the sales chart: one business day. */
export type DayPoint = {
	/** The local day, YYYY-MM-DD. */
	day: string;
	/** Sales of the day in cents, VAT included, tips and voids excluded. */
	salesCents: number;
	/** Guests of the day. */
	covers: number;
};

/** The daily points of the period and their sums, for the totals box of the chart card. */
export type SalesByDay = {
	points: DayPoint[];
	totalSalesCents: number;
	totalCovers: number;
};

/** The last `days` days, oldest first. Today closes the series with its real checks so far. */
export function buildSalesByDay(
	history: DailyTotals[],
	today: TodayTotals,
	todayStart: number,
	days: number,
): SalesByDay {
	const points: DayPoint[] = [
		...history.slice(-(days - 1)).map((entry) => ({
			day: entry.day,
			salesCents: entry.salesCents,
			covers: entry.covers,
		})),
		{
			day: toIsoDay(new Date(todayStart)),
			salesCents: today.salesCents,
			covers: today.covers,
		},
	];
	return {
		points,
		totalSalesCents: points.reduce((sum, point) => sum + point.salesCents, 0),
		totalCovers: points.reduce((sum, point) => sum + point.covers, 0),
	};
}

/**
 * One value of a stat context line. A money value is in cents.
 * A count value takes its noun from the `counts` group of the dictionary: "1 cover" or "4 covers".
 */
export type StatContextValue =
	| { kind: "money"; cents: number }
	| { kind: "count"; count: number; noun: keyof Dictionary["counts"] }
	| { kind: "number"; value: number };

/** One stat card of the home. The page turns the keys into text with t(). */
export type StatItem = {
	/** Stable id, also the React key and the chart color slot. */
	id: "sales" | "checks" | "average" | "tables";
	labelKey: TranslationKey;
	/** The value in its unit: a count, or cents when `isMoney` is true. */
	value: number;
	isMoney: boolean;
	/** Ratio against the same weekday last week at this time: 0.12 is +12 %. null shows no delta. */
	change: number | null;
	/** The context line after the delta. Each slot of the message gets one value: { covers } fills "for {covers}". */
	contextKey: TranslationKey;
	context: Record<string, StatContextValue>;
};

/** The table statuses of a table with guests. A reserved or free table is not open. */
const OPEN_TABLE_STATUSES = new Set(["seated", "ordered", "served", "bill"]);

/** The 4 stat cards: sales, checks, average ticket, and open tables. `lastWeek` is undefined without history. */
export function buildStats(
	today: TodayTotals,
	lastWeek: TodayTotals | undefined,
	board: FloorTable[],
): StatItem[] {
	const average =
		today.checks === 0 ? 0 : Math.round(today.salesCents / today.checks);
	const lastAverage =
		lastWeek && lastWeek.checks > 0
			? lastWeek.salesCents / lastWeek.checks
			: undefined;
	const openTables = board.filter((entry) =>
		OPEN_TABLE_STATUSES.has(entry.status),
	);
	const guests = guestsAt(openTables);
	return [
		{
			id: "sales",
			labelKey: "dashboard.salesToday",
			value: today.salesCents,
			isMoney: true,
			change: lastWeek
				? changeRatio(today.salesCents, lastWeek.salesCents)
				: null,
			contextKey: "dashboard.vsLastWeek",
			context: {},
		},
		{
			id: "checks",
			labelKey: "dashboard.checksToday",
			value: today.checks,
			isMoney: false,
			change: lastWeek ? changeRatio(today.checks, lastWeek.checks) : null,
			contextKey: "dashboard.coversContext",
			context: {
				covers: { kind: "count", count: today.covers, noun: "covers" },
			},
		},
		{
			id: "average",
			labelKey: "dashboard.averageTicket",
			value: average,
			isMoney: true,
			change:
				lastAverage === undefined ? null : changeRatio(average, lastAverage),
			contextKey: "dashboard.perCoverContext",
			context: {
				amount: {
					kind: "money",
					cents:
						today.covers === 0
							? 0
							: Math.round(today.salesCents / today.covers),
				},
			},
		},
		{
			id: "tables",
			labelKey: "dashboard.tablesOpen",
			value: openTables.length,
			isMoney: false,
			// A table count has no week-old twin: the floor of last week at this minute is not stored.
			change: null,
			contextKey: "dashboard.tablesContext",
			context: {
				tables: { kind: "number", value: board.length },
				guests: { kind: "count", count: guests, noun: "guests" },
			},
		},
	];
}

/** One row of the best sellers card. */
export type TopDish = {
	/** The menu item id. Also the React key. */
	id: string;
	name: string;
	category: MenuCategory;
	/** Portions sold today, voids excluded. */
	sold: number;
};

/** The `count` dishes with the most portions today. A tie keeps the order of the first sale. */
export function buildTopDishes(orders: Order[], count: number): TopDish[] {
	const dishes = new Map<string, TopDish>();
	for (const line of orders
		.filter(isCountedOrder)
		.flatMap((order) => order.lines)) {
		const dish = dishes.get(line.menuItemId) ?? {
			id: line.menuItemId,
			name: line.name,
			category: line.category,
			sold: 0,
		};
		dish.sold += line.quantity;
		dishes.set(line.menuItemId, dish);
	}
	return [...dishes.values()]
		.sort((first, second) => second.sold - first.sold)
		.slice(0, count);
}

/** The 4 steps of a check that the status card counts. A void is not a step of the service. */
export const CHECK_STEPS = [
	"in_kitchen",
	"served",
	"bill",
	"paid",
] as const satisfies readonly OrderStatus[];

/** One step of the status card. */
export type CheckStep = {
	status: (typeof CHECK_STEPS)[number];
	/** Checks of the day at this step now. */
	count: number;
	/** count of all counted checks, 0 to 1. 0 when no check exists. */
	share: number;
};

/** The count and the share of each step. The shares of the 4 steps add up to 1. */
export function buildCheckSteps(orders: Order[]): CheckStep[] {
	const counted = orders.filter(isCountedOrder);
	return CHECK_STEPS.map((status) => {
		const count = counted.filter((order) => order.status === status).length;
		return {
			status,
			count,
			share: counted.length === 0 ? 0 : count / counted.length,
		};
	});
}
