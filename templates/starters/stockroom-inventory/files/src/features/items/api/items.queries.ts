// Reads of stock items: the list with stock levels, one item with its context and level history, and its picks per day.
// The routes of /app/items prefetch them in their loaders. The home and the supplier panel read the list too.
// Each queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	addLocalDays,
	buildDailyPicks,
	dayKeyOf,
	getSampleTables,
	type ItemRow,
	isOpenOrderStatus,
	lateDaysOf,
	type MovementReason,
	type PeriodDays,
	type PurchaseOrderStatus,
	type SampleTables,
	STOCK_STATUSES,
	type StockCategory,
	type StockStatus,
	type StockUnit,
	type SupplierRow,
	stockStatusOf,
} from "~/features/stock";

// The usage rate looks at the last 30 days: long enough to smooth a week, short enough to follow a trend.
const USAGE_DAYS = 30;
// The item page lists the newest receipts, counts, and damage. Five rows end the main column near the rail end.
const ITEM_MOVEMENT_COUNT = 5;
// The level chart of the item page shows about three order cycles.
const LEVEL_DAYS = 90;
// The item page lists the newest orders of the item.
const ITEM_ORDER_COUNT = 6;

/** One stock item with its level and the numbers that the lists show. */
export type StockItem = {
	/** The lower case SKU. It is also the URL id. */
	id: string;
	sku: string;
	name: string;
	category: StockCategory;
	unit: StockUnit;
	/** Aisle, bay, and level, for example "A-03-2". */
	bin: string;
	supplierId: string;
	supplierName: string;
	/** Purchase price of one unit, in the stock currency. */
	unitCost: number;
	/** The reorder point. */
	minimum: number;
	/** The quantity of one order line. */
	reorderQuantity: number;
	onHand: number;
	status: StockStatus;
	/** Units on sent orders that did not arrive yet. */
	onOrder: number;
	/** Units on draft orders that the buyer did not send yet. They are not in onOrder. */
	onDraft: number;
	/** Mean units picked per calendar day over the last 30 days. */
	dailyUsage: number;
	/** Days until the shelf is empty at the usage rate. null when nothing was picked in 30 days. */
	daysOfCover: number | null;
	/** onHand times unitCost, in the stock currency. */
	stockValue: number;
	/** ISO time of the newest movement. null for an item with no movement. */
	lastMovementAt: string | null;
};

/** One movement on the item page. */
export type ItemMovement = {
	id: string;
	reason: MovementReason;
	/** Signed units. */
	quantity: number;
	balanceAfter: number;
	/** The pick ticket, order number, count sheet, or damage report. */
	reference: string;
	/** The order id of a receipt, for a link to the order panel. null for other movements. */
	purchaseOrderId: string | null;
	occurredAt: string;
};

/** One purchase order line of the item, with the facts of its order. */
export type ItemOrder = {
	/** The order id, for a link to the order panel. */
	orderId: string;
	number: string;
	status: PurchaseOrderStatus;
	/** Full days past the expected day. 0 when on time or closed. */
	lateDays: number;
	/** Local midnight of the promised day, as ISO. */
	expectedOn: string;
	quantityOrdered: number;
	quantityReceived: number;
	/** ISO time of the newest delivery of the order. null before the first delivery. */
	lastReceivedAt: string | null;
};

/** The stock of one item at the end of one day. `day` is YYYY-MM-DD in the browser time zone. */
export type ItemLevelPoint = {
	day: string;
	onHand: number;
};

/** Everything that the item page shows, except the picks chart. */
export type ItemDetail = {
	item: StockItem;
	supplier: SupplierRow;
	/** The newest receipts, counts, and damage, newest first. Picks are not in the list. */
	movements: ItemMovement[];
	/** Newest first. */
	orders: ItemOrder[];
	/** The stock at the end of each of the last 90 full days, oldest first. */
	levels: ItemLevelPoint[];
};

// The rows of every item, with their levels. One pass over the movements and the orders.
function toStockItems(tables: SampleTables): StockItem[] {
	const usageStart = addLocalDays(tables.todayStart, -USAGE_DAYS);
	const pickedUnits = new Map<string, number>();
	const lastMovement = new Map<string, string>();
	// Movements are newest first, so the first one seen per item is its newest.
	for (const movement of tables.movements) {
		if (!lastMovement.has(movement.itemId)) {
			lastMovement.set(movement.itemId, movement.occurredAt);
		}
		if (
			movement.reason === "pick" &&
			Date.parse(movement.occurredAt) >= usageStart
		) {
			pickedUnits.set(
				movement.itemId,
				(pickedUnits.get(movement.itemId) ?? 0) - movement.quantity,
			);
		}
	}
	const onOrder = new Map<string, number>();
	const onDraft = new Map<string, number>();
	for (const order of tables.purchaseOrders) {
		// A draft is not sent, so its units are not on order yet. The home still names it.
		if (order.status === "draft") {
			for (const line of order.lines) {
				onDraft.set(
					line.itemId,
					(onDraft.get(line.itemId) ?? 0) + line.quantityOrdered,
				);
			}
			continue;
		}
		if (!isOpenOrderStatus(order.status)) {
			continue;
		}
		for (const line of order.lines) {
			onOrder.set(
				line.itemId,
				(onOrder.get(line.itemId) ?? 0) +
					line.quantityOrdered -
					line.quantityReceived,
			);
		}
	}
	const supplierName = new Map(
		tables.suppliers.map((supplier) => [supplier.id, supplier.name]),
	);
	return tables.items.map((item: ItemRow) => {
		const dailyUsage = (pickedUnits.get(item.id) ?? 0) / USAGE_DAYS;
		return {
			id: item.id,
			sku: item.sku,
			name: item.name,
			category: item.category,
			unit: item.unit,
			bin: item.bin,
			supplierId: item.supplierId,
			supplierName: supplierName.get(item.supplierId) ?? "",
			unitCost: item.unitCost,
			minimum: item.minimum,
			reorderQuantity: item.reorderQuantity,
			onHand: item.onHand,
			status: stockStatusOf(item.onHand, item.minimum),
			onOrder: onOrder.get(item.id) ?? 0,
			onDraft: onDraft.get(item.id) ?? 0,
			dailyUsage,
			daysOfCover: dailyUsage > 0 ? item.onHand / dailyUsage : null,
			stockValue: item.onHand * item.unitCost,
			lastMovementAt: lastMovement.get(item.id) ?? null,
		};
	});
}

// The end-of-day stock of the last LEVEL_DAYS full days, oldest first.
// The tables hold no event of today, so the level of today is also the level at the end of yesterday.
// From there, each day takes back its net movement to give the level of the day before.
function buildLevels(
	onHand: number,
	movements: SampleTables["movements"],
	todayStart: number,
): ItemLevelPoint[] {
	const changeByDay = new Map<string, number>();
	for (const movement of movements) {
		const day = dayKeyOf(Date.parse(movement.occurredAt));
		changeByDay.set(day, (changeByDay.get(day) ?? 0) + movement.quantity);
	}
	const levels: ItemLevelPoint[] = [];
	let balance = onHand;
	for (let offset = -1; offset >= -LEVEL_DAYS; offset -= 1) {
		const day = dayKeyOf(addLocalDays(todayStart, offset));
		levels.push({ day, onHand: balance });
		balance -= changeByDay.get(day) ?? 0;
	}
	return levels.reverse();
}

// The most urgent first: out of stock, then low, then in stock. Inside a level, the shortest cover first.
function compareUrgency(first: StockItem, second: StockItem): number {
	const byStatus =
		STOCK_STATUSES.indexOf(first.status) -
		STOCK_STATUSES.indexOf(second.status);
	if (byStatus !== 0) {
		return byStatus;
	}
	return (
		(first.daysOfCover ?? Number.POSITIVE_INFINITY) -
		(second.daysOfCover ?? Number.POSITIVE_INFINITY)
	);
}

/** Every item, the most urgent first. The list page filters, searches, sorts, and pages them in the browser. */
export function itemsQueryOptions() {
	return queryOptions({
		queryKey: ["items", "list"],
		queryFn: async () => toStockItems(getSampleTables()).sort(compareUrgency),
	});
}

/** One item with its supplier, newest movements, and newest orders. null when the id does not exist. */
export function itemQueryOptions(itemId: string) {
	return queryOptions({
		queryKey: ["items", "detail", itemId],
		queryFn: async (): Promise<ItemDetail | null> => {
			const tables = getSampleTables();
			const item = toStockItems(tables).find(
				(candidate) => candidate.id === itemId,
			);
			const supplier = tables.suppliers.find(
				(candidate) => candidate.id === item?.supplierId,
			);
			if (!item || !supplier) {
				return null;
			}
			const itemMovements = tables.movements.filter(
				(movement) => movement.itemId === item.id,
			);
			// Picks are left out: the picks chart above the list already shows them per day.
			const movements = itemMovements
				.filter((movement) => movement.reason !== "pick")
				.slice(0, ITEM_MOVEMENT_COUNT)
				.map((movement) => ({
					id: movement.id,
					reason: movement.reason,
					quantity: movement.quantity,
					balanceAfter: movement.balanceAfter,
					reference: movement.reference,
					purchaseOrderId: movement.purchaseOrderId,
					occurredAt: movement.occurredAt,
				}));
			const orders: ItemOrder[] = [];
			for (const order of tables.purchaseOrders) {
				const line = order.lines.find(
					(candidate) => candidate.itemId === item.id,
				);
				if (!line) {
					continue;
				}
				orders.push({
					orderId: order.id,
					number: order.number,
					status: order.status,
					lateDays: lateDaysOf(order, tables.todayStart),
					expectedOn: order.expectedOn,
					quantityOrdered: line.quantityOrdered,
					quantityReceived: line.quantityReceived,
					lastReceivedAt: order.receipts.at(-1)?.receivedAt ?? null,
				});
				if (orders.length === ITEM_ORDER_COUNT) {
					break;
				}
			}
			const levels = buildLevels(item.onHand, itemMovements, tables.todayStart);
			return { item, supplier, movements, orders, levels };
		},
	});
}

/** The period of the first load of the item chart. The route loader prefetches it. */
export const ITEM_DEFAULT_DAYS: PeriodDays = 30;

/** Units of one item picked per day over `days` full days, with the period before. Feeds the item chart. */
export function itemDailyPicksQueryOptions(itemId: string, days: PeriodDays) {
	return queryOptions({
		queryKey: ["items", "daily-picks", itemId, days],
		queryFn: async () => {
			const tables = getSampleTables();
			return buildDailyPicks(
				tables.movements.filter((movement) => movement.itemId === itemId),
				tables.todayStart,
				days,
			);
		},
	});
}
