// Reads of the targets page: the team target, the product mix, the territories, and the reps of one quarter.
// The targets route prefetches both quarters. TargetsPage reads the chosen one with useQuery.
// The queryFn reads the sample tables. A later turn replaces its body with Supabase calls that return the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	attainmentOf,
	getSampleTables,
	type PaceStatus,
	type ProductLine,
	paceStatusOf,
	type QuarterProgress,
	quarterLabelOf,
	quarterOfDay,
	quarterProgressOf,
	type RepRole,
	type SampleTables,
	sellingDaysBetween,
	shiftQuarter,
	todayDayNumber,
} from "~/features/sales";

/** The quarters that the page can show. */
export const QUARTER_CHOICES = ["current", "previous"] as const;

/** One quarter choice of the page. */
export type QuarterChoice = (typeof QUARTER_CHOICES)[number];

/** One rep inside a territory row. */
export type TerritoryRep = {
	id: string;
	name: string;
	attainment: number;
	status: PaceStatus;
};

/** One territory against its target: the sum of the targets of its reps. */
export type TerritoryTarget = {
	id: string;
	name: string;
	target: number;
	booked: number;
	attainment: number;
	status: PaceStatus;
	/** The best attainment first. */
	reps: TerritoryRep[];
};

/** One rep with the "behind" pace status: under 90 % of the expected amount, or under the target of a closed quarter. */
export type RepShortfall = {
	id: string;
	name: string;
	territoryName: string;
	/** target * pace - booked, in CURRENCY. Above 0. */
	shortfall: number;
	attainment: number;
};

/** One rep against the target of the quarter, for the table of the page. */
export type RepTarget = {
	id: string;
	name: string;
	role: RepRole;
	email: string;
	territoryName: string;
	target: number;
	booked: number;
	attainment: number;
	status: PaceStatus;
};

/** Everything that the targets page shows for one quarter. Amounts are whole units of CURRENCY. */
export type QuarterTargets = {
	/** "Q4 2026". */
	quarterLabel: string;
	/** The quarter before, for example "Q3 2026". The KPI deltas compare with it. */
	previousLabel: string;
	/** True for a quarter that ended before today. */
	isClosed: boolean;
	progress: QuarterProgress;
	team: {
		target: number;
		booked: number;
		attainment: number;
		status: PaceStatus;
		/** target * pace. */
		expectedByToday: number;
		/** The gap divided by the weekdays left, today included. 0 for a closed quarter or a met target. */
		neededPerSellingDay: number;
		/** Weekdays from today to the end of the quarter, today included. 0 for a closed quarter. */
		sellingDaysLeft: number;
		/** The team target of the quarter before. 0 when that quarter has no target. */
		previousTarget: number;
		/** The booked amount of the quarter before, after the same count of days. */
		previousBooked: number;
	};
	/** Booked amount per product line in the quarter, largest first. */
	productMix: { productLine: ProductLine; amount: number }[];
	/** The best attainment first. */
	territories: TerritoryTarget[];
	/** Every rep that is behind, the largest shortfall first. The "Behind" filter of the reps page counts the same reps. */
	shortfalls: RepShortfall[];
	/** Every rep, the best attainment first. */
	reps: RepTarget[];
};

// The targets of one quarter for the day tables.today.
function buildQuarterTargets(
	tables: SampleTables,
	choice: QuarterChoice,
): QuarterTargets {
	const today = tables.today;
	const quarter = shiftQuarter(
		quarterOfDay(today),
		choice === "current" ? 0 : -1,
	);
	const progress = quarterProgressOf(quarter, today);
	const toDay = Math.min(today, quarter.endDay);

	// The quarter before, after the same count of days: the KPI deltas compare with it.
	const previousQuarter = shiftQuarter(quarter, -1);
	const previousToDay = Math.min(
		previousQuarter.startDay + (toDay - quarter.startDay),
		previousQuarter.endDay,
	);

	const bookedByRep = new Map<string, number>();
	const mix = new Map<ProductLine, number>();
	let previousBooked = 0;
	for (const order of tables.orders) {
		if (order.isCancelled) {
			continue;
		}
		if (order.day >= quarter.startDay && order.day < toDay) {
			bookedByRep.set(
				order.repId,
				(bookedByRep.get(order.repId) ?? 0) + order.amount,
			);
			for (const line of order.lines) {
				mix.set(
					line.productLine,
					(mix.get(line.productLine) ?? 0) + line.amount,
				);
			}
		} else if (
			order.day >= previousQuarter.startDay &&
			order.day < previousToDay
		) {
			previousBooked += order.amount;
		}
	}
	const previousTarget = tables.targets
		.filter((row) => row.quarterStartDay === previousQuarter.startDay)
		.reduce((sum, row) => sum + row.amount, 0);
	const targetByRep = new Map(
		tables.targets
			.filter((row) => row.quarterStartDay === quarter.startDay)
			.map((row) => [row.repId, row.amount]),
	);

	const territories = tables.territories
		.map((territory) => {
			const reps = tables.reps
				.filter((rep) => rep.territoryId === territory.id)
				.map((rep) => {
					const attainment = attainmentOf(
						bookedByRep.get(rep.id) ?? 0,
						targetByRep.get(rep.id) ?? 0,
					);
					return {
						id: rep.id,
						name: rep.name,
						attainment,
						status: paceStatusOf(attainment, progress.pace),
					};
				})
				.sort((first, second) => second.attainment - first.attainment);
			const target = reps.reduce(
				(sum, rep) => sum + (targetByRep.get(rep.id) ?? 0),
				0,
			);
			const booked = reps.reduce(
				(sum, rep) => sum + (bookedByRep.get(rep.id) ?? 0),
				0,
			);
			const attainment = attainmentOf(booked, target);
			return {
				id: territory.id,
				name: territory.name,
				target,
				booked,
				attainment,
				status: paceStatusOf(attainment, progress.pace),
				reps,
			};
		})
		.sort((first, second) => second.attainment - first.attainment);

	const teamTarget = territories.reduce((sum, row) => sum + row.target, 0);
	const teamBooked = territories.reduce((sum, row) => sum + row.booked, 0);
	const teamAttainment = attainmentOf(teamBooked, teamTarget);

	const sellingDaysLeft = sellingDaysBetween(
		Math.max(today, quarter.startDay),
		quarter.endDay,
	);
	const gap = Math.max(teamTarget - teamBooked, 0);

	const territoryNames = new Map(
		tables.territories.map((row) => [row.id, row.name]),
	);
	const repTargets = tables.reps
		.map((rep) => {
			const target = targetByRep.get(rep.id) ?? 0;
			const booked = bookedByRep.get(rep.id) ?? 0;
			const attainment = attainmentOf(booked, target);
			return {
				id: rep.id,
				name: rep.name,
				role: rep.role,
				email: rep.email,
				territoryName: territoryNames.get(rep.territoryId) ?? "",
				target,
				booked,
				attainment,
				status: paceStatusOf(attainment, progress.pace),
			};
		})
		.sort((first, second) => second.attainment - first.attainment);

	return {
		quarterLabel: quarterLabelOf(quarter),
		previousLabel: quarterLabelOf(previousQuarter),
		isClosed: quarter.endDay <= today,
		progress,
		team: {
			target: teamTarget,
			booked: teamBooked,
			attainment: teamAttainment,
			status: paceStatusOf(teamAttainment, progress.pace),
			expectedByToday: teamTarget * progress.pace,
			neededPerSellingDay: sellingDaysLeft > 0 ? gap / sellingDaysLeft : 0,
			sellingDaysLeft,
			previousTarget,
			previousBooked,
		},
		productMix: [...mix]
			.map(([productLine, amount]) => ({ productLine, amount }))
			.sort((first, second) => second.amount - first.amount),
		territories,
		// The list uses the pace rule of the badges, so its reps match the "Behind" filter of the reps page.
		shortfalls: repTargets
			.filter((rep) => rep.status === "behind")
			.map((rep) => ({
				id: rep.id,
				name: rep.name,
				territoryName: rep.territoryName,
				shortfall: rep.target * progress.pace - rep.booked,
				attainment: rep.attainment,
			}))
			.sort((first, second) => second.shortfall - first.shortfall),
		reps: repTargets,
	};
}

/** The targets of the current or the previous quarter. The key holds the choice, so a tab change reads another entry. */
export function quarterTargetsQueryOptions(choice: QuarterChoice) {
	return queryOptions({
		queryKey: ["targets", "quarter", choice],
		queryFn: async (): Promise<QuarterTargets> =>
			buildQuarterTargets(getSampleTables(todayDayNumber()), choice),
	});
}
