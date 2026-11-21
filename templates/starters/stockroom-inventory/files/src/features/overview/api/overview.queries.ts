// Reads of the home: every figure and series of one period, in one summary.
// The loader of the home route prefetches the default period. OverviewPage reads the chosen period.
// The queryFn reads the sample tables. A later turn replaces its body with Supabase read functions (STARTER.md).
import { queryOptions } from "@tanstack/react-query";
import {
	addLocalDays,
	buildDailyPicks,
	calendarDaysBetween,
	changeRatio,
	type DailyPoint,
	dayKeyOf,
	deliveryDelayDays,
	getSampleTables,
	isOpenAt,
	onHandAt,
	type PeriodDays,
	type SampleTables,
	STOCK_CATEGORIES,
	type StockCategory,
	type StockUnit,
	stockStatusOf,
} from "~/features/stock";

/** The period of the first load of the home, in days. */
export const OVERVIEW_DEFAULT_DAYS: PeriodDays = 30;

/** A figure now and its change against the start of the period. */
export type Figure = {
	value: number;
	/** Ratio against the value at the start of the period: 0.12 is +12 %. null when that value was 0. */
	change: number | null;
};

/** The item with the most units picked in the period. */
export type TopItem = {
	/** The lower case SKU, also the URL id of the item page. */
	id: string;
	name: string;
	sku: string;
	unit: StockUnit;
	/** Units picked in the period. */
	units: number;
	/** Ratio against the units of the same item in the period before. */
	change: number | null;
};

/** One bar group of the stock in and out chart: the units of a few days. */
export type FlowBucket = {
	/** YYYY-MM-DD of the first day of the bucket. */
	firstDay: string;
	/** YYYY-MM-DD of the last day of the bucket. The axis label shows it. */
	lastDay: string;
	/** Units received at the dock. */
	unitsIn: number;
	/** Units picked from the shelves. */
	unitsOut: number;
};

/** The picks of one family in the period. */
export type FamilyPicks = {
	category: StockCategory;
	units: number;
	/** Part of all picked units, from 0 to 1. */
	share: number;
	/** Ratio against the units of the family in the period before. */
	change: number | null;
};

/** The stock value of one family now, in whole units of the stock currency. */
export type FamilyValue = {
	category: StockCategory;
	value: number;
};

/** The delay groups of the delivery record, from early to very late. */
export const DELAY_BUCKETS = [
	"early",
	"onTime",
	"late1",
	"late2to3",
	"late4plus",
] as const;

/** One delay group. Its label is the message key `overview.delays.<bucket>`. */
export type DelayBucket = (typeof DELAY_BUCKETS)[number];

/** The newest order received in full, for the highlight box of the delivery record. */
export type LatestDelivery = {
	/** The order id, also the `po` search value of the order panel. */
	orderId: string;
	number: string;
	supplierName: string;
	/** The account manager at the supplier. */
	contactName: string;
	/** ISO time of the last receipt, which completed the order. */
	receivedAt: string;
	/** Units of all lines of the order, over all its receipts. */
	units: number;
	lineCount: number;
	/** Calendar days from the expected day to this delivery. Negative is early. */
	delayDays: number;
};

/** Everything that the home shows for one period. */
export type OverviewSummary = {
	/** null when nothing was picked in the period. */
	topItem: TopItem | null;
	/** Stock value now, in the stock currency. Its change compares with the value at the start of the period. */
	stockValue: Figure;
	/** Items under their reorder point now, out of stock included. */
	lowStock: Figure;
	/** Sent orders that wait for goods now. */
	openOrders: Figure;
	/** Oldest first. 7 buckets of 1 day, or 6 buckets of 5 or 15 days. */
	flow: FlowBucket[];
	/** Units picked per day of the period, with the same days one period earlier. */
	picks: DailyPoint[];
	/** Units picked in the period, against the period before. */
	unitsPicked: Figure;
	/** One entry per family, the most picked first. */
	families: FamilyPicks[];
	/** One entry per family, the largest value first. */
	valueByFamily: FamilyValue[];
	deliveries: {
		/** Orders delivered in full in the period. */
		count: number;
		/** Share delivered on or before the expected day. null when no order was delivered. */
		onTimeRate: number | null;
		/** One entry per delay group, in the order of DELAY_BUCKETS. */
		buckets: { bucket: DelayBucket; count: number }[];
		/** null before the first delivery of the history. */
		latest: LatestDelivery | null;
	};
};

// The bar chart keeps about 6 groups, as the kit card does: 1 day per bar for a week, 5 or 15 days for longer periods.
const FLOW_BUCKET_DAYS: Record<PeriodDays, number> = { 7: 1, 30: 5, 90: 15 };

// The delay group of a delivery that came `delay` calendar days after the expected day.
function delayBucketOf(delay: number): DelayBucket {
	if (delay < 0) {
		return "early";
	}
	if (delay === 0) {
		return "onTime";
	}
	if (delay === 1) {
		return "late1";
	}
	return delay <= 3 ? "late2to3" : "late4plus";
}

// Units picked per item in [from, to). A pick is a negative movement, so the sign flips.
function pickedUnitsByItem(
	tables: SampleTables,
	from: number,
	to: number,
): Map<string, number> {
	const units = new Map<string, number>();
	for (const movement of tables.movements) {
		const at = Date.parse(movement.occurredAt);
		if (movement.reason !== "pick" || at < from || at >= to) {
			continue;
		}
		units.set(
			movement.itemId,
			(units.get(movement.itemId) ?? 0) - movement.quantity,
		);
	}
	return units;
}

function buildFlow(
	tables: SampleTables,
	days: PeriodDays,
	periodStart: number,
): FlowBucket[] {
	const bucketDays = FLOW_BUCKET_DAYS[days];
	const flow: FlowBucket[] = Array.from(
		{ length: days / bucketDays },
		(_, index) => ({
			firstDay: dayKeyOf(addLocalDays(periodStart, index * bucketDays)),
			lastDay: dayKeyOf(
				addLocalDays(periodStart, (index + 1) * bucketDays - 1),
			),
			unitsIn: 0,
			unitsOut: 0,
		}),
	);
	for (const movement of tables.movements) {
		const at = Date.parse(movement.occurredAt);
		if (at < periodStart) {
			// Movements are newest first: the rest is older than the period.
			break;
		}
		const bucket =
			flow[Math.floor(calendarDaysBetween(periodStart, at) / bucketDays)];
		if (!bucket) {
			continue;
		}
		// Counts and damage are corrections, not flow: the chart shows the dock and the picks only.
		if (movement.reason === "receipt") {
			bucket.unitsIn += movement.quantity;
		} else if (movement.reason === "pick") {
			bucket.unitsOut -= movement.quantity;
		}
	}
	return flow;
}

function buildDeliveries(
	tables: SampleTables,
	periodStart: number,
): OverviewSummary["deliveries"] {
	const counts = new Map<DelayBucket, number>();
	let count = 0;
	for (const order of tables.purchaseOrders) {
		const last = order.receipts.at(-1);
		const delay = deliveryDelayDays(order);
		if (
			order.status !== "received" ||
			!last ||
			delay === null ||
			Date.parse(last.receivedAt) < periodStart
		) {
			continue;
		}
		count += 1;
		const bucket = delayBucketOf(delay);
		counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
	}
	const onTime = (counts.get("early") ?? 0) + (counts.get("onTime") ?? 0);

	let latest: LatestDelivery | null = null;
	for (const order of tables.purchaseOrders) {
		const receipt = order.receipts.at(-1);
		// Only orders received in full, as in the delay bars: the box then shows an order that the bars count.
		if (
			order.status !== "received" ||
			!receipt ||
			(latest && receipt.receivedAt <= latest.receivedAt)
		) {
			continue;
		}
		const supplier = tables.suppliers.find(
			(candidate) => candidate.id === order.supplierId,
		);
		latest = {
			orderId: order.id,
			number: order.number,
			supplierName: supplier?.name ?? "",
			contactName: supplier?.contactName ?? "",
			receivedAt: receipt.receivedAt,
			// The order is received in full, so its units are the ordered units of all its lines.
			units: order.lines.reduce((sum, line) => sum + line.quantityOrdered, 0),
			lineCount: order.lines.length,
			delayDays: calendarDaysBetween(
				Date.parse(order.expectedOn),
				Date.parse(receipt.receivedAt),
			),
		};
	}

	return {
		count,
		onTimeRate: count === 0 ? null : onTime / count,
		buckets: DELAY_BUCKETS.map((bucket) => ({
			bucket,
			count: counts.get(bucket) ?? 0,
		})),
		latest,
	};
}

function buildOverviewSummary(
	tables: SampleTables,
	days: PeriodDays,
): OverviewSummary {
	const { todayStart } = tables;
	const periodStart = addLocalDays(todayStart, -days);
	const previousStart = addLocalDays(todayStart, -2 * days);

	const picked = pickedUnitsByItem(tables, periodStart, todayStart);
	const pickedBefore = pickedUnitsByItem(tables, previousStart, periodStart);
	let topItem: TopItem | null = null;
	for (const item of tables.items) {
		const units = picked.get(item.id) ?? 0;
		if (units > 0 && units > (topItem?.units ?? 0)) {
			topItem = {
				id: item.id,
				name: item.name,
				sku: item.sku,
				unit: item.unit,
				units,
				change: changeRatio(units, pickedBefore.get(item.id) ?? 0),
			};
		}
	}

	// The levels at the start of the period give the "then" side of the stock figures.
	const levelsThen = onHandAt(tables, periodStart);
	const valueNow = tables.items.reduce(
		(sum, item) => sum + item.onHand * item.unitCost,
		0,
	);
	const valueThen = tables.items.reduce(
		(sum, item) => sum + (levelsThen.get(item.id) ?? 0) * item.unitCost,
		0,
	);
	const lowNow = tables.items.filter(
		(item) => stockStatusOf(item.onHand, item.minimum) !== "ok",
	).length;
	const lowThen = tables.items.filter(
		(item) =>
			stockStatusOf(levelsThen.get(item.id) ?? 0, item.minimum) !== "ok",
	).length;
	const openNow = tables.purchaseOrders.filter((order) =>
		isOpenAt(order, todayStart),
	).length;
	const openThen = tables.purchaseOrders.filter((order) =>
		isOpenAt(order, periodStart),
	).length;

	const picks = buildDailyPicks(tables.movements, todayStart, days);
	const unitsPicked = picks.reduce((sum, point) => sum + point.current, 0);
	const unitsBefore = picks.reduce((sum, point) => sum + point.previous, 0);

	const familyUnits = new Map<StockCategory, number>();
	const familyBefore = new Map<StockCategory, number>();
	const familyValue = new Map<StockCategory, number>();
	for (const item of tables.items) {
		familyUnits.set(
			item.category,
			(familyUnits.get(item.category) ?? 0) + (picked.get(item.id) ?? 0),
		);
		familyBefore.set(
			item.category,
			(familyBefore.get(item.category) ?? 0) + (pickedBefore.get(item.id) ?? 0),
		);
		familyValue.set(
			item.category,
			(familyValue.get(item.category) ?? 0) + item.onHand * item.unitCost,
		);
	}

	return {
		topItem,
		stockValue: { value: valueNow, change: changeRatio(valueNow, valueThen) },
		lowStock: { value: lowNow, change: changeRatio(lowNow, lowThen) },
		openOrders: { value: openNow, change: changeRatio(openNow, openThen) },
		flow: buildFlow(tables, days, periodStart),
		picks,
		unitsPicked: {
			value: unitsPicked,
			change: changeRatio(unitsPicked, unitsBefore),
		},
		families: STOCK_CATEGORIES.map((category) => {
			const units = familyUnits.get(category) ?? 0;
			return {
				category,
				units,
				share: unitsPicked === 0 ? 0 : units / unitsPicked,
				change: changeRatio(units, familyBefore.get(category) ?? 0),
			};
		}).sort((first, second) => second.units - first.units),
		// Whole units: the donut and its legend show whole amounts.
		valueByFamily: STOCK_CATEGORIES.map((category) => ({
			category,
			value: Math.round(familyValue.get(category) ?? 0),
		})).sort((first, second) => second.value - first.value),
		deliveries: buildDeliveries(tables, periodStart),
	};
}

/** Every figure and series of the home for the last `days` full days. The period select changes the key. */
export function overviewQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["overview", "summary", days],
		queryFn: async () => buildOverviewSummary(getSampleTables(), days),
	});
}
