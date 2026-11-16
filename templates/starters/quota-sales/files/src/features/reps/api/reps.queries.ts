// Reads of the reps: the board of every rep for the current quarter, and the full record of one rep.
// The reps routes prefetch them. The reps list and the rep page read them from the cache.
// Each queryFn reads the sample tables. A later turn replaces its body with Supabase calls that return the same types.
import { queryOptions } from "@tanstack/react-query";
import {
	type AccountSegment,
	attainmentOf,
	bookedByDay,
	dayKeyOf,
	getSampleTables,
	type Order,
	type PaceStatus,
	type ProductLine,
	paceStatusOf,
	type Quarter,
	type QuarterProgress,
	quarterLabelOf,
	quarterOfDay,
	quarterProgressOf,
	type RepRole,
	type SampleTables,
	sellingDaysBetween,
	shiftQuarter,
	type TerritoryRow,
	todayDayNumber,
	toOrders,
	weekdayOf,
} from "~/features/sales";

/** One rep against the target of one quarter. Amounts are whole units of CURRENCY. */
export type RepSummary = {
	id: string;
	name: string;
	role: RepRole;
	territoryId: string;
	territoryName: string;
	target: number;
	/** Booked amount of the quarter up to yesterday, cancelled orders left out. */
	booked: number;
	/** Count of the orders behind `booked`. */
	orders: number;
	/** booked / orders, or 0 with no order. */
	averageOrder: number;
	/** booked / target. */
	attainment: number;
	status: PaceStatus;
};

/** The reps list: every rep for the current quarter, the best attainment first. */
export type RepsBoard = {
	/** "Q4 2026". */
	quarterLabel: string;
	progress: QuarterProgress;
	territories: TerritoryRow[];
	reps: RepSummary[];
};

/** One Monday-to-Sunday week of the quarter on the rep page. The first and the last week can be short. */
export type RepWeek = {
	/** The first day of the week inside the quarter, as YYYY-MM-DD: a Monday, or the first day of the quarter. */
	weekStart: string;
	/** Booked amount of the week up to yesterday. null for a week that starts today or later. */
	booked: number | null;
	/** The share of the quarter target for the days of this week inside the quarter. */
	target: number;
	/** True for the week of today: its booked amount covers only the days up to yesterday. */
	isPartial: boolean;
};

/** One customer of the rep with its orders of the quarter. */
export type RepAccount = {
	id: string;
	name: string;
	segment: AccountSegment;
	orders: number;
	amount: number;
};

/** The result of one past quarter. */
export type RepQuarterResult = {
	/** "Q3 2026". */
	label: string;
	target: number;
	booked: number;
	attainment: number;
};

/** Everything that the page of one rep shows. */
export type RepDetail = RepSummary & {
	email: string;
	/** The start date of the rep, as YYYY-MM-DD. */
	startedOn: string;
	quarterLabel: string;
	progress: QuarterProgress;
	/** target * pace: the amount that a linear pace expects by today. */
	expectedByToday: number;
	/** The gap divided by the weekdays left in the quarter, today included. 0 when the target is met. */
	neededPerSellingDay: number;
	weeks: RepWeek[];
	/** Booked amount per product line in the quarter, largest first. Lines with no booking are left out. */
	productMix: { productLine: ProductLine; amount: number }[];
	/** The 5 largest accounts of the quarter. */
	topAccounts: RepAccount[];
	/** The last 4 closed quarters, newest first. */
	history: RepQuarterResult[];
	/** The orders of the quarter, newest first, cancelled ones included. */
	quarterOrders: Order[];
};

// The rep summaries of one quarter, up to the day `toDay` (excluded).
function summarize(
	tables: SampleTables,
	quarter: Quarter,
	toDay: number,
): RepSummary[] {
	const progress = quarterProgressOf(quarter, tables.today);
	const territories = new Map(tables.territories.map((row) => [row.id, row]));
	return tables.reps.map((rep) => {
		let booked = 0;
		let orders = 0;
		for (const order of tables.orders) {
			if (
				order.repId === rep.id &&
				order.day >= quarter.startDay &&
				order.day < toDay &&
				!order.isCancelled
			) {
				booked += order.amount;
				orders += 1;
			}
		}
		const target =
			tables.targets.find(
				(row) =>
					row.repId === rep.id && row.quarterStartDay === quarter.startDay,
			)?.amount ?? 0;
		const attainment = attainmentOf(booked, target);
		return {
			id: rep.id,
			name: rep.name,
			role: rep.role,
			territoryId: rep.territoryId,
			territoryName: territories.get(rep.territoryId)?.name ?? "",
			target,
			booked,
			orders,
			averageOrder: orders > 0 ? booked / orders : 0,
			attainment,
			status: paceStatusOf(attainment, progress.pace),
		};
	});
}

/** Every rep against the target of the current quarter. The list page filters, searches, and sorts them. */
export function repsQueryOptions() {
	return queryOptions({
		queryKey: ["reps", "board"],
		queryFn: async (): Promise<RepsBoard> => {
			const tables = getSampleTables(todayDayNumber());
			const quarter = quarterOfDay(tables.today);
			return {
				quarterLabel: quarterLabelOf(quarter),
				progress: quarterProgressOf(quarter, tables.today),
				territories: tables.territories,
				reps: summarize(tables, quarter, tables.today).sort(
					(first, second) => second.attainment - first.attainment,
				),
			};
		},
	});
}

// The detail of one rep. null when the id is not in the team.
function buildRepDetail(tables: SampleTables, repId: string): RepDetail | null {
	const rep = tables.reps.find((row) => row.id === repId);
	if (!rep) {
		return null;
	}
	const today = tables.today;
	const quarter = quarterOfDay(today);
	const progress = quarterProgressOf(quarter, today);
	const summary = summarize(tables, quarter, today).find(
		(row) => row.id === repId,
	);
	if (!summary) {
		return null;
	}
	const quarterRows = tables.orders.filter(
		(order) => order.repId === repId && order.day >= quarter.startDay,
	);
	const booked = bookedByDay(quarterRows);

	// Weeks run Monday to Sunday, as a sales team counts them. The edges of the quarter cut the first and the last week.
	// weekdayOf counts from Sunday (0), so (weekday + 6) % 7 is the count of days since Monday.
	const firstMonday =
		quarter.startDay - ((weekdayOf(quarter.startDay) + 6) % 7);
	const weeks: RepWeek[] = [];
	for (let monday = firstMonday; monday < quarter.endDay; monday += 7) {
		const start = Math.max(monday, quarter.startDay);
		const end = Math.min(monday + 7, quarter.endDay);
		let weekBooked = 0;
		for (let day = start; day < Math.min(end, today); day += 1) {
			weekBooked += booked.get(day) ?? 0;
		}
		weeks.push({
			weekStart: dayKeyOf(start),
			booked: start < today ? weekBooked : null,
			target: (summary.target * (end - start)) / progress.totalDays,
			isPartial: start < today && today < end,
		});
	}

	const mix = new Map<ProductLine, number>();
	const accounts = new Map<string, { orders: number; amount: number }>();
	for (const order of quarterRows) {
		if (order.isCancelled) {
			continue;
		}
		for (const line of order.lines) {
			mix.set(line.productLine, (mix.get(line.productLine) ?? 0) + line.amount);
		}
		const account = accounts.get(order.accountId) ?? { orders: 0, amount: 0 };
		accounts.set(order.accountId, {
			orders: account.orders + 1,
			amount: account.amount + order.amount,
		});
	}
	const accountRows = new Map(tables.accounts.map((row) => [row.id, row]));
	const topAccounts = [...accounts]
		.flatMap(([id, totals]) => {
			const account = accountRows.get(id);
			return account
				? [{ id, name: account.name, segment: account.segment, ...totals }]
				: [];
		})
		.sort((first, second) => second.amount - first.amount)
		.slice(0, 5);

	const history = [1, 2, 3, 4].map((back) => {
		const past = shiftQuarter(quarter, -back);
		const result = summarize(tables, past, past.endDay).find(
			(row) => row.id === repId,
		);
		return {
			label: quarterLabelOf(past),
			target: result?.target ?? 0,
			booked: result?.booked ?? 0,
			attainment: result?.attainment ?? 0,
		};
	});

	const gap = Math.max(summary.target - summary.booked, 0);
	const daysLeft = sellingDaysBetween(
		Math.max(today, quarter.startDay),
		quarter.endDay,
	);
	return {
		...summary,
		email: rep.email,
		startedOn: dayKeyOf(today - rep.tenureDays),
		quarterLabel: quarterLabelOf(quarter),
		progress,
		expectedByToday: summary.target * progress.pace,
		neededPerSellingDay: daysLeft > 0 ? gap / daysLeft : 0,
		weeks,
		productMix: [...mix]
			.map(([productLine, amount]) => ({ productLine, amount }))
			.sort((first, second) => second.amount - first.amount),
		topAccounts,
		history,
		quarterOrders: toOrders(quarterRows, tables),
	};
}

/** One rep with the quarter facts, the weeks, the mix, the accounts, the history, and the orders. null for an unknown id. */
export function repQueryOptions(repId: string) {
	return queryOptions({
		queryKey: ["reps", "detail", repId],
		queryFn: async (): Promise<RepDetail | null> =>
			buildRepDetail(getSampleTables(todayDayNumber()), repId),
	});
}
