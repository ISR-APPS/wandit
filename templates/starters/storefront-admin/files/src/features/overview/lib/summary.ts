// The figures of the home for one period, built from the order rows in one pure function.
// overview.queries.ts calls buildOverviewSummary. The cards of the home page draw its parts.
// A SQL read function does the same sums later. Every figure counts only orders that count as revenue.
import {
	type BreakdownSlice,
	buildDailySeries,
	calendarDaysFromNow,
	changeRatio,
	countsAsRevenue,
	DAY_MS,
	type DailyPoint,
	type PeriodFigure,
	PRODUCT_CATEGORIES,
	type ProductCategory,
	periodFigureOf,
	type SalesArea,
	type SampleTables,
	salesAreaOf,
	totalsOf,
} from "~/features/shop";

/** The day of the period with the most revenue. */
export type BestDay = {
	/** YYYY-MM-DD in the browser time zone. */
	day: string;
	/** Revenue of that day, in the app currency. */
	revenue: number;
	orderCount: number;
	/** Ratio against the daily average of the period: 0.65 is 65 % above it. */
	aboveAverage: number;
};

/** The revenue of one calendar month, split by who placed the orders. */
export type MonthRevenue = {
	/** YYYY-MM in the browser time zone. */
	month: string;
	/** Revenue of the first orders of new customers. */
	newCustomers: number;
	/** Revenue of the second and later orders of a customer. */
	returningCustomers: number;
};

/** The revenue of one sales area in the period. */
export type AreaRevenue = {
	area: SalesArea;
	revenue: number;
	/** Change against the same area in the period before. */
	change: number | null;
};

/** The delivery times of the orders that arrived in the period. */
export type DeliveryTimes = {
	/** Orders whose parcel arrived in the period. */
	deliveredCount: number;
	/** Mean days from the order to the door, with decimals. null when no parcel arrived. */
	averageDays: number | null;
	/** Parcels per whole count of days: 1, 2, 3, 4, then 5 and more. Index 0 is "1 day". */
	buckets: number[];
};

/** One product with its sales of the period. */
export type BestSeller = {
	id: string;
	name: string;
	sku: string;
	category: ProductCategory;
	/** Revenue of the lines of this product, at the price of the order. */
	revenue: number;
	units: number;
};

/** Every figure of the home for one period. */
export type OverviewSummary = {
	bestDay: BestDay | null;
	orders: PeriodFigure;
	/** Revenue divided by the count of orders. 0 with no order. */
	averageOrder: PeriodFigure;
	/** Share of the orders that came from a customer who ordered before: 0.48 is 48 %. */
	returningShare: PeriodFigure;
	/** Revenue per day of the period, with the same days one period earlier. */
	revenueDaily: DailyPoint[];
	revenue: PeriodFigure;
	/** The last 6 calendar months, oldest first. The newest one ends yesterday. */
	months: MonthRevenue[];
	/** The 6 areas with the most revenue, the best first. */
	areas: AreaRevenue[];
	/** Units sold per category, in the order of PRODUCT_CATEGORIES. */
	categories: BreakdownSlice<ProductCategory>[];
	delivery: DeliveryTimes;
	/** Every product that sold in the period, the most revenue first. */
	bestSellers: BestSeller[];
};

/** The month chart shows this count of calendar months. */
const MONTH_COUNT = 6;
/** The region card shows this count of areas. The others still count in the total. */
const AREA_COUNT = 6;
/** The last bucket of the delivery card holds this count of days and more. */
const LAST_BUCKET_DAYS = 5;

/**
 * True when `iso` falls in the last `days` full days before the day of `now`: 1 is yesterday, today is out.
 * The summary and the CSV export of the home page both use it, so they count the same orders.
 */
export function isInPeriod(iso: string, days: number, now: number): boolean {
	const daysAgo = -calendarDaysFromNow(iso, now);
	return daysAgo >= 1 && daysAgo <= days;
}

// YYYY-MM of a time in the browser time zone.
function monthKey(ms: number): string {
	const date = new Date(ms);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * The figures of the last `days` full days (the last one is yesterday), each against the `days` days before.
 * The month chart ignores `days`: it always shows the last 6 calendar months.
 */
export function buildOverviewSummary(
	tables: SampleTables,
	days: number,
): OverviewSummary {
	const { dayStart } = tables;
	// The first order of each customer. The rows are in time order, so the first one seen wins.
	const firstOrderOf = new Map<string, string>();
	for (const order of tables.orders) {
		if (!firstOrderOf.has(order.customerId)) {
			firstOrderOf.set(order.customerId, order.id);
		}
	}
	const regionOf = new Map(
		tables.customers.map((customer) => [customer.id, customer.region]),
	);
	const products = new Map(
		tables.products.map((product) => [product.id, product]),
	);
	const paid = tables.orders.filter((order) => countsAsRevenue(order.status));
	// Days before today: 1 is yesterday. The period is 1 to `days`, the period before is `days + 1` to `2 * days`.
	const isCurrent = (iso: string) => isInPeriod(iso, days, dayStart);
	const isPrevious = (iso: string) => {
		const daysAgo = -calendarDaysFromNow(iso, dayStart);
		return daysAgo > days && daysAgo <= 2 * days;
	};
	const current = paid.filter((order) => isCurrent(order.placedAt));
	const previous = paid.filter((order) => isPrevious(order.placedAt));
	const sumTotal = (orders: typeof paid) =>
		orders.reduce((sum, order) => sum + order.total, 0);
	const returningCount = (orders: typeof paid) =>
		orders.filter((order) => firstOrderOf.get(order.customerId) !== order.id)
			.length;
	const share = (part: number, whole: number) =>
		whole === 0 ? 0 : part / whole;

	const revenueDaily = buildDailySeries(
		paid.map((order) => ({ occurredAt: order.placedAt, value: order.total })),
		days,
		dayStart,
	);
	const ordersDaily = buildDailySeries(
		paid.map((order) => ({ occurredAt: order.placedAt, value: 1 })),
		days,
		dayStart,
	);
	const revenueTotals = totalsOf(revenueDaily);
	const dailyAverage = revenueTotals.current / days;
	const bestPoint = revenueDaily.reduce<DailyPoint | null>(
		(best, point) => (point.current > (best?.current ?? 0) ? point : best),
		null,
	);

	// The 6 months that end with the month of yesterday, oldest first.
	const lastMonth = new Date(dayStart - 1);
	const months: MonthRevenue[] = Array.from(
		{ length: MONTH_COUNT },
		(_, index) => ({
			month: monthKey(
				new Date(
					lastMonth.getFullYear(),
					lastMonth.getMonth() - (MONTH_COUNT - 1 - index),
					1,
				).getTime(),
			),
			newCustomers: 0,
			returningCustomers: 0,
		}),
	);
	const monthIndex = new Map(
		months.map((month, index) => [month.month, index]),
	);
	for (const order of paid) {
		const month =
			months[monthIndex.get(monthKey(Date.parse(order.placedAt))) ?? -1];
		if (!month) {
			continue;
		}
		if (firstOrderOf.get(order.customerId) === order.id) {
			month.newCustomers += order.total;
		} else {
			month.returningCustomers += order.total;
		}
	}

	const areaNow = new Map<SalesArea, number>();
	const areaBefore = new Map<SalesArea, number>();
	for (const order of [...current, ...previous]) {
		const area = salesAreaOf(regionOf.get(order.customerId) ?? "");
		if (!area) {
			continue;
		}
		const target = isCurrent(order.placedAt) ? areaNow : areaBefore;
		target.set(area, (target.get(area) ?? 0) + order.total);
	}
	const areas = [...areaNow.entries()]
		.map(([area, revenue]) => ({
			area,
			revenue,
			change: changeRatio(revenue, areaBefore.get(area) ?? 0),
		}))
		.sort((first, second) => second.revenue - first.revenue)
		.slice(0, AREA_COUNT);

	const currentIds = new Set(current.map((order) => order.id));
	const unitsByCategory = new Map<ProductCategory, number>();
	const sales = new Map<string, { revenue: number; units: number }>();
	for (const line of tables.orderLines) {
		const product = products.get(line.productId);
		if (!currentIds.has(line.orderId) || !product) {
			continue;
		}
		unitsByCategory.set(
			product.category,
			(unitsByCategory.get(product.category) ?? 0) + line.quantity,
		);
		const own = sales.get(product.id) ?? { revenue: 0, units: 0 };
		sales.set(product.id, {
			revenue: own.revenue + line.quantity * line.unitPrice,
			units: own.units + line.quantity,
		});
	}
	const bestSellers = [...sales.entries()]
		.flatMap(([id, figures]) => {
			const product = products.get(id);
			return product
				? [
						{
							id,
							name: product.name,
							sku: product.sku,
							category: product.category,
							...figures,
						},
					]
				: [];
		})
		.sort((first, second) => second.revenue - first.revenue);

	// A delivery counts in the period of its arrival. A refund later keeps the delivery.
	const deliveries = tables.orders.flatMap((order) =>
		order.deliveredAt && isCurrent(order.deliveredAt)
			? [(Date.parse(order.deliveredAt) - Date.parse(order.placedAt)) / DAY_MS]
			: [],
	);
	const buckets = new Array<number>(LAST_BUCKET_DAYS).fill(0);
	for (const deliveryDays of deliveries) {
		// A parcel that arrives within 24 hours counts as 1 day, so the first bucket is "1 day or less".
		const bucket =
			Math.min(Math.max(Math.ceil(deliveryDays), 1), LAST_BUCKET_DAYS) - 1;
		buckets[bucket] = (buckets[bucket] ?? 0) + 1;
	}

	return {
		bestDay:
			bestPoint && dailyAverage > 0
				? {
						day: bestPoint.day,
						revenue: bestPoint.current,
						orderCount:
							ordersDaily.find((point) => point.day === bestPoint.day)
								?.current ?? 0,
						aboveAverage: (bestPoint.current - dailyAverage) / dailyAverage,
					}
				: null,
		orders: periodFigureOf(current.length, previous.length),
		averageOrder: periodFigureOf(
			share(sumTotal(current), current.length),
			share(sumTotal(previous), previous.length),
		),
		returningShare: periodFigureOf(
			share(returningCount(current), current.length),
			share(returningCount(previous), previous.length),
		),
		revenueDaily,
		revenue: {
			value: revenueTotals.current,
			change: revenueTotals.change,
		},
		months,
		areas,
		categories: PRODUCT_CATEGORIES.map((category) => ({
			label: category,
			value: unitsByCategory.get(category) ?? 0,
		})),
		delivery: {
			deliveredCount: deliveries.length,
			averageDays:
				deliveries.length === 0
					? null
					: deliveries.reduce((sum, value) => sum + value, 0) /
						deliveries.length,
			buckets,
		},
		bestSellers,
	};
}
