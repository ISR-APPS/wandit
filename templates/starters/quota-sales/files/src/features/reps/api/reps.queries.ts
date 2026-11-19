// Reads of the reps: the board of every rep for the current quarter, and the full record of one rep.
// The reps routes prefetch them. The reps list and the rep page read them from the cache.
// Each queryFn reads the sample tables. A later turn replaces its body with Supabase calls that return the same types.
import { queryOptions } from "@tanstack/react-query";
import {
	type AccountSegment,
	attainmentOf,
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
	type TerritoryRow,
	todayDayNumber,
	toOrders,
} from "~/features/sales";

/** One rep against the target of one quarter. Amounts are whole units of CURRENCY. */
export type RepSummary = {
	id: string;
	name: string;
	/** Work email on example.com. The row menu copies it or opens the mail app. */
	email: string;
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

/** One customer of the rep with its orders of the quarter. */
export type RepAccount = {
	id: string;
	name: string;
	segment: AccountSegment;
	/** Orders of the quarter up to yesterday, cancelled ones left out. */
	orders: number;
	/** Booked amount of those orders, in whole units of CURRENCY. */
	amount: number;
};

/** Everything that the page of one rep shows. */
export type RepDetail = RepSummary & {
	/** The start date of the rep, as YYYY-MM-DD. */
	startedOn: string;
	/** "Q4 2026". */
	quarterLabel: string;
	/** The gap divided by the weekdays left in the quarter, today included. 0 when the target is met. */
	neededPerSellingDay: number;
	/** Booked amount per product line in the quarter, largest first. Lines with no booking are left out. */
	productMix: { productLine: ProductLine; amount: number }[];
	/** Every account that the rep owns, the largest amount of the quarter first. */
	accounts: RepAccount[];
	/** The orders of the quarter, newest first, cancelled ones included. */
	quarterOrders: Order[];
};

/** The rep summaries of one quarter, up to the day `toDay` (excluded). The alerts query reads it too. */
export function summarize(
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
			email: rep.email,
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
	const summary = summarize(tables, quarter, today).find(
		(row) => row.id === repId,
	);
	if (!summary) {
		return null;
	}
	const quarterRows = tables.orders.filter(
		(order) => order.repId === repId && order.day >= quarter.startDay,
	);

	const mix = new Map<ProductLine, number>();
	const totals = new Map<string, { orders: number; amount: number }>();
	for (const order of quarterRows) {
		if (order.isCancelled) {
			continue;
		}
		for (const line of order.lines) {
			mix.set(line.productLine, (mix.get(line.productLine) ?? 0) + line.amount);
		}
		const account = totals.get(order.accountId) ?? { orders: 0, amount: 0 };
		totals.set(order.accountId, {
			orders: account.orders + 1,
			amount: account.amount + order.amount,
		});
	}
	// Every owned account shows, also one with no order this quarter: the rep still has to call it.
	const accounts = tables.accounts
		.filter((account) => account.ownerId === repId)
		.map((account) => ({
			id: account.id,
			name: account.name,
			segment: account.segment,
			orders: totals.get(account.id)?.orders ?? 0,
			amount: totals.get(account.id)?.amount ?? 0,
		}))
		.sort((first, second) => second.amount - first.amount);

	const gap = Math.max(summary.target - summary.booked, 0);
	const daysLeft = sellingDaysBetween(
		Math.max(today, quarter.startDay),
		quarter.endDay,
	);
	return {
		...summary,
		startedOn: dayKeyOf(today - rep.tenureDays),
		quarterLabel: quarterLabelOf(quarter),
		neededPerSellingDay: daysLeft > 0 ? gap / daysLeft : 0,
		productMix: [...mix]
			.map(([productLine, amount]) => ({ productLine, amount }))
			.sort((first, second) => second.amount - first.amount),
		accounts,
		quarterOrders: toOrders(quarterRows, tables),
	};
}

/** One rep with the quarter facts, the product mix, the accounts, and the orders. null for an unknown id. */
export function repQueryOptions(repId: string) {
	return queryOptions({
		queryKey: ["reps", "detail", repId],
		queryFn: async (): Promise<RepDetail | null> =>
			buildRepDetail(getSampleTables(todayDayNumber()), repId),
	});
}
