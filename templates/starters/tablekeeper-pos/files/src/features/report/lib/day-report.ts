// The math of the day report: figures, sales per hour, payments, categories, servers, VAT, and voids.
// dayReportQueryOptions calls buildDayReport with the checks of the day. The report panels read its parts.
// Every part counts the same lines as the floor and the menu, so each part adds up to the gross sales.
import { changeRatio, type KpiItem, totalsOfToday } from "~/features/floor";
import {
	isCountedOrder,
	lineTotalCents,
	lineVatCents,
	MENU_CATEGORIES,
	type MenuCategory,
	type Order,
	orderSubtotalCents,
	type PaymentMethod,
	type TodayTotals,
} from "~/features/restaurant";

/** Sales of one clock hour. A till reports a sale when it is taken: a paid check in the hour of its payment. */
export type HourPoint = {
	/** ISO time of the start of the hour, in the browser time zone. */
	hourStart: string;
	/** Sales of the checks paid in this hour, open checks in their opening hour. In cents, VAT included. */
	salesCents: number;
	/** The checks of salesCents, voids excluded. */
	checks: number;
};

/** One row of the payments panel. "open" is the checks that are still on the floor. */
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

/** The work of one server today. */
export type ServerRow = {
	/** The server id. Also the React key. */
	id: string;
	name: string;
	checks: number;
	covers: number;
	salesCents: number;
	/** Card tips on the paid checks of this server, in cents. */
	tipsCents: number;
};

/** The VAT inside the sales at one rate. gross = net + VAT. */
export type VatRow = {
	/** 0.1 or 0.2. */
	rate: number;
	grossCents: number;
	vatCents: number;
	netCents: number;
};

/** Everything that the day report shows. All amounts are whole cents. */
export type DayReport = {
	/** ISO time when the first check of the day opened. null before the first check. */
	openedAt: string | null;
	/** The 4 figures of the band: sales, checks, covers, and the average check. */
	figures: KpiItem[];
	grossCents: number;
	tipsCents: number;
	hours: HourPoint[];
	payments: PaymentRow[];
	/** Every category in menu order, with zero rows kept. */
	categories: CategoryRow[];
	/** The servers, the highest sales first. */
	servers: ServerRow[];
	/** The VAT rates, the lowest rate first. */
	vat: VatRow[];
	voids: { checks: number; cents: number };
};

const HOUR_MS = 3_600_000;

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

	const figures: KpiItem[] = [
		{
			id: "gross-sales",
			labelKey: "report.grossSales",
			value: today.salesCents,
			isMoney: true,
			change: compare(today.salesCents, lastWeek?.salesCents),
			goodWhen: "up",
		},
		{
			id: "checks",
			labelKey: "report.checks",
			value: today.checks,
			isMoney: false,
			change: compare(today.checks, lastWeek?.checks),
			goodWhen: "up",
		},
		{
			id: "covers",
			labelKey: "report.covers",
			value: today.covers,
			isMoney: false,
			change: compare(today.covers, lastWeek?.covers),
			goodWhen: "up",
		},
		{
			id: "average-check",
			labelKey: "report.averageCheck",
			value: averageCents,
			isMoney: true,
			change: compare(averageCents, lastWeekAverage),
			goodWhen: "up",
		},
	];

	const firstOrder = orders.at(-1);
	return {
		openedAt: firstOrder?.openedAt ?? null,
		figures,
		grossCents: today.salesCents,
		tipsCents: counted.reduce((sum, order) => sum + order.tipCents, 0),
		hours: firstOrder ? buildHours(counted, firstOrder.openedAt, now) : [],
		payments: buildPayments(counted),
		categories: buildCategories(counted),
		servers: buildServers(counted),
		vat: buildVat(counted),
		voids: {
			checks: orders.length - counted.length,
			cents: orders
				.filter((order) => !isCountedOrder(order))
				.reduce((sum, order) => sum + orderSubtotalCents(order), 0),
		},
	};
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
		hours.push({
			hourStart: new Date(hour).toISOString(),
			salesCents: inHour.reduce(
				(sum, order) => sum + orderSubtotalCents(order),
				0,
			),
			checks: inHour.length,
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

// One row per server who had a check today, the highest sales first.
function buildServers(counted: Order[]): ServerRow[] {
	const rows = new Map<string, ServerRow>();
	for (const order of counted) {
		const row = rows.get(order.serverId) ?? {
			id: order.serverId,
			name: order.serverName,
			checks: 0,
			covers: 0,
			salesCents: 0,
			tipsCents: 0,
		};
		row.checks += 1;
		row.covers += order.covers;
		row.salesCents += orderSubtotalCents(order);
		row.tipsCents += order.tipCents;
		rows.set(order.serverId, row);
	}
	return [...rows.values()].sort(
		(first, second) => second.salesCents - first.salesCents,
	);
}

// The sales and the VAT inside them per rate. Net is the sales minus the VAT.
function buildVat(counted: Order[]): VatRow[] {
	const rows = new Map<number, VatRow>();
	for (const line of counted.flatMap((order) => order.lines)) {
		const row = rows.get(line.vatRate) ?? {
			rate: line.vatRate,
			grossCents: 0,
			vatCents: 0,
			netCents: 0,
		};
		row.grossCents += lineTotalCents(line);
		row.vatCents += lineVatCents(line);
		row.netCents = row.grossCents - row.vatCents;
		rows.set(line.vatRate, row);
	}
	return [...rows.values()].sort((first, second) => first.rate - second.rate);
}
