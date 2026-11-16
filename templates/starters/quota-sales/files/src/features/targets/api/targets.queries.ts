// Reads of the targets page: the team, territory, and month targets of the current or the previous quarter.
// The targets route prefetches both quarters. TargetsPage reads the chosen one with useQuery.
// The queryFn reads the sample tables. A later turn replaces its body with Supabase calls that return the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	attainmentOf,
	DAY_MS,
	dayKeyOf,
	getSampleTables,
	type PaceStatus,
	paceStatusOf,
	type QuarterProgress,
	quarterLabelOf,
	quarterOfDay,
	quarterProgressOf,
	type SampleTables,
	sellingDaysBetween,
	shiftQuarter,
	todayDayNumber,
	utcDateOf,
} from "~/features/sales";

/** The quarters that the page can show. */
export const QUARTER_CHOICES = ["current", "previous"] as const;

/** One quarter choice of the page. */
export type QuarterChoice = (typeof QUARTER_CHOICES)[number];

/** The plan splits a quarter target over its 3 months. The last month carries the quarter-end push. */
const MONTH_SHARES = [0.31, 0.33, 0.36] as const;

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

/** The state of a month of the plan on today. */
export type MonthState = "closed" | "current" | "upcoming";

/** One month of the quarter plan. */
export type MonthTarget = {
	/** The first day of the month, as YYYY-MM-DD. */
	monthStart: string;
	/** The share of the team target for this month, in CURRENCY. */
	target: number;
	/** The share of MONTH_SHARES, 0 to 1. */
	share: number;
	/** Booked amount of the month up to yesterday. */
	booked: number;
	attainment: number;
	/** The share of the month that has passed, 0 to 1: 1 for a closed month, 0 for an upcoming month. */
	pace: number;
	state: MonthState;
};

/** Everything that the targets page shows for one quarter. Amounts are whole units of CURRENCY. */
export type QuarterTargets = {
	/** "Q4 2026". */
	quarterLabel: string;
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
	};
	/** The best attainment first. */
	territories: TerritoryTarget[];
	/** Every rep that is behind, the largest shortfall first. The "Behind" tab of the reps list counts the same reps. */
	shortfalls: RepShortfall[];
	months: MonthTarget[];
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

	const bookedByRep = new Map<string, number>();
	const bookedByDayOfQuarter = new Map<number, number>();
	for (const order of tables.orders) {
		if (
			order.day >= quarter.startDay &&
			order.day < toDay &&
			!order.isCancelled
		) {
			bookedByRep.set(
				order.repId,
				(bookedByRep.get(order.repId) ?? 0) + order.amount,
			);
			bookedByDayOfQuarter.set(
				order.day,
				(bookedByDayOfQuarter.get(order.day) ?? 0) + order.amount,
			);
		}
	}
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

	const firstMonth = utcDateOf(quarter.startDay);
	const months = MONTH_SHARES.map((share, index) => {
		const start = Math.round(
			Date.UTC(
				firstMonth.getUTCFullYear(),
				firstMonth.getUTCMonth() + index,
				1,
			) / DAY_MS,
		);
		const end = Math.round(
			Date.UTC(
				firstMonth.getUTCFullYear(),
				firstMonth.getUTCMonth() + index + 1,
				1,
			) / DAY_MS,
		);
		let booked = 0;
		for (let day = start; day < Math.min(end, toDay); day += 1) {
			booked += bookedByDayOfQuarter.get(day) ?? 0;
		}
		const target = teamTarget * share;
		const state: MonthState =
			end <= today ? "closed" : start > today ? "upcoming" : "current";
		return {
			monthStart: dayKeyOf(start),
			target,
			share,
			booked,
			attainment: attainmentOf(booked, target),
			pace: Math.min(Math.max(today - start, 0), end - start) / (end - start),
			state,
		};
	});

	return {
		quarterLabel: quarterLabelOf(quarter),
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
		},
		territories,
		shortfalls: tables.reps
			.flatMap((rep) => {
				const target = targetByRep.get(rep.id) ?? 0;
				const booked = bookedByRep.get(rep.id) ?? 0;
				const attainment = attainmentOf(booked, target);
				// The rail uses the pace rule of the badges, so its reps match the "Behind" count of the reps list.
				return paceStatusOf(attainment, progress.pace) === "behind"
					? [
							{
								id: rep.id,
								name: rep.name,
								territoryName:
									tables.territories.find((row) => row.id === rep.territoryId)
										?.name ?? "",
								shortfall: target * progress.pace - booked,
								attainment,
							},
						]
					: [];
			})
			.sort((first, second) => second.shortfall - first.shortfall),
		months,
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
