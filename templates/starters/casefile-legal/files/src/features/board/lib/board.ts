// The math of the board home: the stage columns, the declined count, the closed series, and the four figures.
// BoardPage groups the matter list with buildBoard. board.queries.ts calls the other functions in its queryFn.
// It is pure: every function takes the rows and "now", so a test or a later SQL function gives the same numbers.

import type { MatterSummary } from "~/features/matters";
import {
	addLocalDays,
	buildDailySeries,
	CURRENCY,
	calendarDaysUntil,
	changeRatio,
	DEADLINE_SOON_DAYS,
	dayKeyOf,
	isOpenStage,
	type SampleTables,
	STAGE_PATH,
	startOfLocalDay,
	toTenths,
} from "~/features/practice";
import type { TranslationKey } from "~/shared/i18n";

/** The period of the closed column, the closed series, the declined line, and the figures. */
export const BOARD_DAYS = 30;

/** A column shows this many slips; a link opens the rest in the matter list. Eight fill a laptop screen. */
export const COLUMN_SLIPS = 8;

/** One column of the board: a stage and its matters, the one that waits longest first. */
export type BoardColumn = {
	stage: (typeof STAGE_PATH)[number];
	matters: MatterSummary[];
};

/** The columns, the matters declined in the period, and the count of deadlines that need attention. */
export type Board = {
	columns: BoardColumn[];
	openCount: number;
	declinedCount: number;
	soonDeadlineCount: number;
};

/** True when the next deadline of the matter falls within DEADLINE_SOON_DAYS calendar days. */
export function hasSoonDeadline(matter: MatterSummary, now: number): boolean {
	return (
		matter.nextDeadline !== null &&
		calendarDaysUntil(matter.nextDeadline.dueAt, now) <= DEADLINE_SOON_DAYS
	);
}

/**
 * Groups the matter list into the columns of the board.
 * The closed column keeps only the last BOARD_DAYS days, else it grows forever. Declined matters get no column.
 */
export function buildBoard(matters: MatterSummary[], now: number): Board {
	// LIMIT: groups every matter in the browser, about a few hundred rows. Upgrade: one SQL query per column with a limit.
	const periodStart = addLocalDays(startOfLocalDay(now), -(BOARD_DAYS - 1));
	const isInPeriod = (timestamp: string | null) =>
		timestamp !== null && Date.parse(timestamp) >= periodStart;
	const columns = STAGE_PATH.map((stage) => ({
		stage,
		matters: matters
			.filter(
				(matter) =>
					matter.stage === stage &&
					(stage !== "closed" || isInPeriod(matter.closedAt)),
			)
			// Oldest change first: the matter that waits longest is on top.
			.sort((first, second) =>
				first.stageChangedAt.localeCompare(second.stageChangedAt),
			),
	}));
	const open = matters.filter((matter) => isOpenStage(matter.stage));
	return {
		columns,
		openCount: open.length,
		declinedCount: matters.filter(
			(matter) => matter.stage === "declined" && isInPeriod(matter.closedAt),
		).length,
		soonDeadlineCount: open.filter((matter) => hasSoonDeadline(matter, now))
			.length,
	};
}

/** Matters closed per local day for the last `days` days, with the same days one period earlier. */
export function closedPerDay(tables: SampleTables, days: number, now: number) {
	const countByDay = new Map<string, number>();
	for (const matter of tables.matters) {
		if (matter.stage === "closed" && matter.closedAt) {
			const day = dayKeyOf(Date.parse(matter.closedAt));
			countByDay.set(day, (countByDay.get(day) ?? 0) + 1);
		}
	}
	return buildDailySeries(days, now, countByDay);
}

/** One figure of the board strip before translation. The page turns `labelKey` into a label. */
export type BoardFigure = {
	id: string;
	labelKey: TranslationKey;
	value: number;
	format?: Intl.NumberFormatOptions;
	change: number | null;
	goodWhen: "up" | "down";
};

/** The four figures of the board, the most important first. Each compares with the 30 days before. */
export function buildBoardFigures(
	tables: SampleTables,
	now: number,
): BoardFigure[] {
	const today = startOfLocalDay(now);
	// "30 days ago" is the same clock time, so both counts look at a full day.
	const monthAgo = addLocalDays(now, -BOARD_DAYS);
	const periodStart = addLocalDays(today, -(BOARD_DAYS - 1));
	const previousStart = addLocalDays(today, -(2 * BOARD_DAYS - 1));
	const isOpenAt =
		(moment: number) => (matter: SampleTables["matters"][number]) =>
			Date.parse(matter.openedAt) <= moment &&
			(matter.closedAt === null || Date.parse(matter.closedAt) > moment);
	const openedBetween = (start: number, end: number) =>
		tables.matters.filter((matter) => {
			const opened = Date.parse(matter.openedAt);
			return opened >= start && opened < end;
		}).length;

	const firstDay = dayKeyOf(periodStart);
	const previousFirstDay = dayKeyOf(previousStart);
	const monthAgoDay = dayKeyOf(monthAgo);
	const issuedAt = new Map(
		tables.invoices.map((invoice) => [
			invoice.id,
			Date.parse(invoice.issuedAt),
		]),
	);
	let hours = 0;
	let previousHours = 0;
	let unbilled = 0;
	let unbilledMonthAgo = 0;
	for (const entry of tables.timeEntries) {
		// Day keys are YYYY-MM-DD, so a text compare is a date compare.
		if (entry.day >= firstDay) {
			hours += entry.hours;
		} else if (entry.day >= previousFirstDay) {
			previousHours += entry.hours;
		}
		if (!entry.billable) {
			continue;
		}
		if (entry.invoiceId === null) {
			unbilled += entry.amount;
		}
		// Unbilled 30 days ago: logged by then, and charged by an invoice issued later or not at all.
		const issued =
			entry.invoiceId === null ? null : issuedAt.get(entry.invoiceId);
		if (entry.day <= monthAgoDay && (issued == null || issued > monthAgo)) {
			unbilledMonthAgo += entry.amount;
		}
	}
	const openNow = tables.matters.filter(isOpenAt(now)).length;
	const openMonthAgo = tables.matters.filter(isOpenAt(monthAgo)).length;
	const newMatters = openedBetween(periodStart, now + 1);
	const previousNewMatters = openedBetween(previousStart, periodStart);
	return [
		{
			id: "open-matters",
			labelKey: "metrics.openMatters",
			value: openNow,
			change: changeRatio(openNow, openMonthAgo),
			goodWhen: "up",
		},
		{
			id: "new-matters",
			labelKey: "metrics.newMatters",
			value: newMatters,
			change: changeRatio(newMatters, previousNewMatters),
			goodWhen: "up",
		},
		{
			id: "hours-logged",
			labelKey: "metrics.hoursLogged",
			value: toTenths(hours),
			format: { maximumFractionDigits: 0 },
			change: changeRatio(hours, previousHours),
			goodWhen: "up",
		},
		{
			id: "unbilled",
			labelKey: "metrics.unbilled",
			value: unbilled,
			format: {
				style: "currency",
				currency: CURRENCY,
				maximumFractionDigits: 0,
			},
			change: changeRatio(unbilled, unbilledMonthAgo),
			// Less unbilled time means the firm bills its work on time.
			goodWhen: "down",
		},
	];
}
