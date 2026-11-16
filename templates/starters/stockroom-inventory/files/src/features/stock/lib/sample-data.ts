// The sample tables of the stockroom: suppliers, items, stock movements, and purchase orders.
// Only the query files (api/*.queries.ts of each feature) read them, through getSampleTables().
// The rows stand in for a database. A later turn replaces each queryFn with a Supabase call, then deletes this file.
// A seeded simulation plays 180 days of picks, receipts, counts, and orders. Every event is before today's midnight.
// LIMIT: the history moves by one day at midnight, so the rows change then. Upgrade: real tables (STARTER.md).
import {
	ITEM_SPECS,
	type StockCategory,
	type StockUnit,
	SUPPLIER_SPECS,
	type SupplierSpec,
} from "./catalog";
import type { MovementReason, PurchaseOrderStatus } from "./statuses";
import { addLocalDays, HOUR_MS, MINUTE_MS, startOfLocalDay } from "./time";

/** Days of history. The 90-day chart compares with the 90 days before, so it needs 180. */
export const HISTORY_DAYS = 180;

/** The currency of every price and amount of the stockroom. A real app reads it from its settings. */
export const STOCK_CURRENCY = "USD";

/** One supplier. */
export type SupplierRow = {
	id: string;
	name: string;
	/** The account manager at the supplier. */
	contactName: string;
	email: string;
	phone: string;
	city: string;
	/** Promised days from the order to the delivery. */
	leadTimeDays: number;
	/** The weekday of the weekly order run: 1 is Monday, 5 is Friday. */
	orderWeekday: number;
};

/** One stock item with its current on-hand quantity. */
export type ItemRow = {
	/** The lower case SKU, for example "pkg-1001". It is also the URL id. */
	id: string;
	/** The SKU on the shelf label, for example "PKG-1001". */
	sku: string;
	name: string;
	category: StockCategory;
	unit: StockUnit;
	/** Aisle, bay, and level of the shelf, for example "A-03-2". The aisle letter names the family. */
	bin: string;
	supplierId: string;
	/** Purchase price of one unit, in STOCK_CURRENCY. */
	unitCost: number;
	/** The reorder point: under this quantity, the item goes on the next order to its supplier. */
	minimum: number;
	/** The quantity of one order line. About 45 days of picks. */
	reorderQuantity: number;
	/** Units on the shelf after the last movement. */
	onHand: number;
};

/** One change of the on-hand quantity of one item. */
export type MovementRow = {
	id: string;
	itemId: string;
	reason: MovementReason;
	/** Signed units: positive for a receipt, negative for a pick or a damage. */
	quantity: number;
	/** The units on the shelf after this movement. */
	balanceAfter: number;
	/** The paper behind it: a pick ticket "PK-…", a purchase order "PO-…", a count sheet "CC-…", or a damage report "DR-…". */
	reference: string;
	/** Purchase order id of a receipt. null for every other movement. */
	purchaseOrderId: string | null;
	/** ISO time. Always before the midnight that starts today. */
	occurredAt: string;
};

/** One line of a purchase order. */
export type PurchaseOrderLineRow = {
	itemId: string;
	quantityOrdered: number;
	/** Units that arrived so far. Never above quantityOrdered. */
	quantityReceived: number;
	/** The agreed price of one unit, in STOCK_CURRENCY. */
	unitCost: number;
};

/** One delivery of goods against a purchase order. A split delivery has two. */
export type ReceiptRow = {
	/** ISO time of the receipt at the dock. */
	receivedAt: string;
	/** Units of all lines in this delivery. */
	units: number;
};

/** One purchase order to a supplier. The times are ISO texts. */
export type PurchaseOrderRow = {
	/** The lower case number, for example "po-24117". It is also the URL search value. */
	id: string;
	/** The number on the paperwork, for example "PO-24117". */
	number: string;
	supplierId: string;
	status: PurchaseOrderStatus;
	createdAt: string;
	/** When the buyer sent the order. null for a draft. */
	orderedAt: string | null;
	/** Local midnight of the day the supplier promised. The order is late from the next day. */
	expectedOn: string;
	/** null unless the buyer cancelled the order. */
	cancelledAt: string | null;
	/** The deliveries so far, oldest first. */
	receipts: ReceiptRow[];
	lines: PurchaseOrderLineRow[];
};

/** Every sample table, built for one day. */
export type SampleTables = {
	/** Local midnight of the day the tables were built for, in milliseconds since 1970. */
	todayStart: number;
	suppliers: SupplierRow[];
	items: ItemRow[];
	/** Newest first. */
	movements: MovementRow[];
	/** Newest first. */
	purchaseOrders: PurchaseOrderRow[];
};

// Picks per weekday against an average Monday to Friday. Sunday: the warehouse is closed.
const WEEKDAY_FACTOR = [0, 1.15, 1.05, 1, 1, 0.9, 0.35];
// A fixed seed gives the same history every time the tables are built for the same day.
const SEED = 20_241;
// The aisle letter of each family, in the order of STOCK_CATEGORIES.
const AISLE_OF: Record<StockCategory, string> = {
	packaging: "A",
	fasteners: "B",
	safety: "C",
	cleaning: "D",
	electrical: "E",
	tools: "F",
};

/** A small seeded generator (mulberry32). It returns numbers from 0 to 1, the same list for the same seed. */
function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = Math.imul(state ^ (state >>> 15), 1 | state);
		value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
		return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
	};
}

// Round a planning quantity to a number that a buyer writes: 5s from 20, 10s from 100.
function roundOrderQuantity(value: number): number {
	if (value >= 100) {
		return Math.ceil(value / 10) * 10;
	}
	if (value >= 20) {
		return Math.ceil(value / 5) * 5;
	}
	return Math.max(2, Math.ceil(value));
}

// A delivery or an order on Sunday moves to Monday: the dock is closed.
function nextOpenDay(todayStart: number, offset: number): number {
	const weekday = new Date(addLocalDays(todayStart, offset)).getDay();
	return weekday === 0 ? offset + 1 : offset;
}

/** One planned delivery of a purchase order: the units per line that arrive on one day. */
type PlannedReceipt = {
	order: PurchaseOrderRow;
	unitsByLine: number[];
};

function buildSampleTables(todayStart: number): SampleTables {
	const random = seededRandom(SEED);
	const between = (min: number, max: number) => min + random() * (max - min);
	const supplierById = new Map<string, SupplierSpec>(
		SUPPLIER_SPECS.map((supplier) => [supplier.id, supplier]),
	);

	const items: ItemRow[] = ITEM_SPECS.map((spec, index) => {
		const supplier = supplierById.get(spec.supplierId);
		// A wrong supplierId in catalog.ts is a bug of the catalog: stop with its SKU.
		if (!supplier) {
			throw new Error(`Unknown supplier "${spec.supplierId}" for ${spec.sku}`);
		}
		// Mean picks per calendar day: the weekday factors add up to 5.45 for 7 days.
		const dailyDemand = (spec.weekdayDemand * 5.45) / 7;
		// The minimum covers the lead time, plus the mean wait for the weekly order run, plus 1 day of margin.
		const minimum = roundOrderQuantity(
			dailyDemand * (supplier.leadTimeDays + 3.5 + 1),
		);
		const positionInFamily = index % 10;
		return {
			id: spec.sku.toLowerCase(),
			sku: spec.sku,
			name: spec.name,
			category: spec.category,
			unit: spec.unit,
			bin: `${AISLE_OF[spec.category]}-${String(Math.floor(positionInFamily / 2) + 1).padStart(2, "0")}-${(positionInFamily % 4) + 1}`,
			supplierId: spec.supplierId,
			unitCost: spec.unitCost,
			minimum,
			reorderQuantity: Math.max(minimum, roundOrderQuantity(dailyDemand * 45)),
			onHand: 0,
		};
	});

	const balance = new Map<string, number>();
	const onOrder = new Map<string, number>();
	for (const item of items) {
		balance.set(
			item.id,
			Math.round(item.minimum + item.reorderQuantity * between(0.15, 1)),
		);
		onOrder.set(item.id, 0);
	}

	const movements: MovementRow[] = [];
	const purchaseOrders: PurchaseOrderRow[] = [];
	const plannedReceipts = new Map<number, PlannedReceipt[]>();
	const plannedCancels = new Map<number, PurchaseOrderRow[]>();
	let pickNumber = 51_200;
	let countNumber = 3_100;
	let damageNumber = 610;
	let orderNumber = 24_000;

	function addMovement(
		item: ItemRow,
		reason: MovementReason,
		quantity: number,
		reference: string,
		occurredAt: number,
		purchaseOrderId: string | null = null,
	) {
		const after = (balance.get(item.id) ?? 0) + quantity;
		balance.set(item.id, after);
		movements.push({
			id: `mv-${movements.length + 1}`,
			itemId: item.id,
			reason,
			quantity,
			balanceAfter: after,
			reference,
			purchaseOrderId,
			occurredAt: new Date(occurredAt).toISOString(),
		});
	}

	function planReceipt(offset: number, receipt: PlannedReceipt) {
		plannedReceipts.set(offset, [
			...(plannedReceipts.get(offset) ?? []),
			receipt,
		]);
	}

	for (let offset = -HISTORY_DAYS; offset < 0; offset += 1) {
		const dayStart = addLocalDays(todayStart, offset);
		const weekday = new Date(dayStart).getDay();
		const at = (fromHour: number, toHour: number) =>
			dayStart + between(fromHour, toHour) * HOUR_MS;

		// 1. Deliveries at the dock, 07:00 to 15:00. dockTimes keeps the time of each received item.
		const dockTimes = new Map<string, number>();
		for (const { order, unitsByLine } of plannedReceipts.get(offset) ?? []) {
			const receivedAt = at(7, 15);
			order.lines.forEach((line, lineIndex) => {
				const units = unitsByLine[lineIndex] ?? 0;
				if (units <= 0) {
					return;
				}
				line.quantityReceived += units;
				onOrder.set(line.itemId, (onOrder.get(line.itemId) ?? 0) - units);
				const item = items.find((candidate) => candidate.id === line.itemId);
				if (item) {
					const lineAt = receivedAt + lineIndex * 2 * MINUTE_MS;
					dockTimes.set(item.id, lineAt);
					addMovement(item, "receipt", units, order.number, lineAt, order.id);
				}
			});
			order.receipts.push({
				receivedAt: new Date(receivedAt).toISOString(),
				units: unitsByLine.reduce((sum, units) => sum + units, 0),
			});
		}
		for (const order of plannedCancels.get(offset) ?? []) {
			order.cancelledAt = new Date(at(9, 11)).toISOString();
			for (const line of order.lines) {
				onOrder.set(
					line.itemId,
					(onOrder.get(line.itemId) ?? 0) - line.quantityOrdered,
				);
			}
		}

		// 2. Picks, 08:00 to 16:00. Demand grows by about 18 % over the history.
		const trend = 0.9 + (0.18 * (offset + HISTORY_DAYS)) / HISTORY_DAYS;
		ITEM_SPECS.forEach((spec, index) => {
			const item = items[index];
			const mean = spec.weekdayDemand * (WEEKDAY_FACTOR[weekday] ?? 0) * trend;
			if (!item || mean === 0) {
				return;
			}
			// floor(x + U) with U from 0 to 1 has the mean x, so slow items get a pick on some days only.
			const asked = Math.floor(mean * between(0.45, 1.55) + random());
			// A pick cannot take more than the shelf holds. The rest of the order waits.
			const picked = Math.min(asked, balance.get(item.id) ?? 0);
			if (picked > 0) {
				pickNumber += 1;
				// The pick comes after the receipt of the same day, so the balance column reads in time order.
				const pickedAt = Math.max(
					at(8, 16),
					(dockTimes.get(item.id) ?? 0) + 15 * MINUTE_MS,
				);
				addMovement(item, "pick", -picked, `PK-${pickNumber}`, pickedAt);
			}
		});

		// 3. Damage found at the end of the shift, and the rolling count of each item about every 4 weeks.
		items.forEach((item, index) => {
			const onShelf = balance.get(item.id) ?? 0;
			if (onShelf > 0 && weekday !== 0 && random() < 0.004) {
				const damaged = Math.min(onShelf, 1 + Math.floor(random() * 3));
				damageNumber += 1;
				addMovement(item, "damage", -damaged, `DR-${damageNumber}`, at(16, 17));
			}
			if ((offset + HISTORY_DAYS + index * 5) % 28 !== 0 || weekday === 0) {
				return;
			}
			const roll = random();
			// Most counts match the system. A mismatch is a few units, more often missing than extra.
			const size = Math.max(1, Math.round(item.reorderQuantity * 0.02));
			const difference =
				roll < 0.55
					? 0
					: roll < 0.85
						? -Math.ceil(size * between(0.5, 1.5))
						: Math.ceil(size * between(0.5, 1.2));
			if (difference !== 0 && onShelf + difference >= 0) {
				countNumber += 1;
				addMovement(
					item,
					"adjustment",
					difference,
					`CC-${countNumber}`,
					at(17, 18),
				);
			}
		});

		// 4. The weekly order run of each supplier: one order with every item under its minimum.
		for (const supplier of SUPPLIER_SPECS) {
			if (supplier.orderWeekday !== weekday) {
				continue;
			}
			const lines: PurchaseOrderLineRow[] = [];
			for (const item of items) {
				const available =
					(balance.get(item.id) ?? 0) + (onOrder.get(item.id) ?? 0);
				if (item.supplierId !== supplier.id || available >= item.minimum) {
					continue;
				}
				// Order whole reorder quantities until the stock clears the minimum again.
				const lots = Math.max(
					1,
					Math.ceil((item.minimum - available) / item.reorderQuantity),
				);
				const quantity = lots * item.reorderQuantity;
				onOrder.set(item.id, (onOrder.get(item.id) ?? 0) + quantity);
				lines.push({
					itemId: item.id,
					quantityOrdered: quantity,
					quantityReceived: 0,
					unitCost: item.unitCost,
				});
			}
			if (lines.length === 0) {
				continue;
			}
			orderNumber += 1;
			const createdAt = at(14, 16);
			// An order of yesterday is still a draft: the buyer sends the run the next morning.
			const isDraft = offset === -1;
			const expectedOffset = nextOpenDay(
				todayStart,
				offset + supplier.leadTimeDays,
			);
			const order: PurchaseOrderRow = {
				id: `po-${orderNumber}`,
				number: `PO-${orderNumber}`,
				supplierId: supplier.id,
				status: "ordered",
				createdAt: new Date(createdAt).toISOString(),
				orderedAt: isDraft
					? null
					: new Date(createdAt + between(20, 90) * MINUTE_MS).toISOString(),
				expectedOn: new Date(
					addLocalDays(todayStart, expectedOffset),
				).toISOString(),
				cancelledAt: null,
				receipts: [],
				lines,
			};
			purchaseOrders.push(order);
			if (isDraft) {
				continue;
			}
			// A few old orders are cancelled the next day; their items go on the next run.
			if (offset < -21 && random() < 0.03) {
				const cancelOffset = offset + 1;
				plannedCancels.set(cancelOffset, [
					...(plannedCancels.get(cancelOffset) ?? []),
					order,
				]);
				continue;
			}
			const isOnTime = random() < supplier.onTimeChance;
			// An on-time supplier sometimes comes a day early. A late one comes 1 to 5 days after the promise.
			const delay = isOnTime
				? random() < 0.25
					? -1
					: 0
				: 1 + Math.floor(random() * 5);
			const arrival = nextOpenDay(todayStart, expectedOffset + delay);
			const shortLine =
				random() < supplier.splitChance
					? Math.floor(random() * lines.length)
					: -1;
			const firstPart = lines.map((line, lineIndex) =>
				lineIndex === shortLine
					? Math.floor(line.quantityOrdered * between(0.4, 0.7))
					: line.quantityOrdered,
			);
			planReceipt(arrival, { order, unitsByLine: firstPart });
			if (shortLine >= 0) {
				planReceipt(
					nextOpenDay(todayStart, arrival + 2 + Math.floor(random() * 3)),
					{
						order,
						unitsByLine: lines.map((line, lineIndex) =>
							lineIndex === shortLine
								? line.quantityOrdered - (firstPart[lineIndex] ?? 0)
								: 0,
						),
					},
				);
			}
		}
	}

	for (const item of items) {
		item.onHand = balance.get(item.id) ?? 0;
	}
	for (const order of purchaseOrders) {
		order.status = statusOfOrder(order);
	}
	movements.sort(
		(first, second) =>
			Date.parse(second.occurredAt) - Date.parse(first.occurredAt),
	);
	purchaseOrders.reverse();

	return {
		todayStart,
		suppliers: SUPPLIER_SPECS.map((supplier) => ({
			id: supplier.id,
			name: supplier.name,
			contactName: supplier.contactName,
			email: supplier.email,
			phone: supplier.phone,
			city: supplier.city,
			leadTimeDays: supplier.leadTimeDays,
			orderWeekday: supplier.orderWeekday,
		})),
		items,
		movements,
		purchaseOrders,
	};
}

// The status at the start of today, from the facts of the order.
function statusOfOrder(order: PurchaseOrderRow): PurchaseOrderStatus {
	if (order.cancelledAt) {
		return "cancelled";
	}
	if (!order.orderedAt) {
		return "draft";
	}
	const ordered = order.lines.reduce(
		(sum, line) => sum + line.quantityOrdered,
		0,
	);
	const received = order.lines.reduce(
		(sum, line) => sum + line.quantityReceived,
		0,
	);
	if (received >= ordered) {
		return "received";
	}
	return received > 0 ? "partly_received" : "ordered";
}

// The tables of the current day. A cache keeps one build per day, so every page reads the same rows.
let cache: SampleTables | null = null;

/** The sample tables for today. The first call of a day builds them (a few milliseconds); the next calls reuse them. */
export function getSampleTables(): SampleTables {
	const todayStart = startOfLocalDay(Date.now());
	if (cache?.todayStart !== todayStart) {
		cache = buildSampleTables(todayStart);
	}
	return cache;
}
