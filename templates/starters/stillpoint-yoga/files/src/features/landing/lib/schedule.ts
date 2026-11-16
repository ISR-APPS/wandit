// The weekly timetable of the studio: one row per class slot, and the days on which it runs.
// ScheduleSection draws the grid from WEEK_ROWS. ReservePanel lists the slots of one practice with sessionsOf().
// The times and days are sample content. STARTER.md says how a table replaces them.
import type { TranslationKey } from "~/shared/i18n";

/** The five practices of the studio. Open Practice runs only on weekends. */
export type PracticeId =
	| "slowFlow"
	| "matPilates"
	| "deepStretch"
	| "breathwork"
	| "openPractice";

/** One day of the week, Monday first, as the grid columns. */
type WeekDay = {
	/** Key of the short head text, for example "Mon". */
	shortKey: TranslationKey;
	/** Key of the full day name, read by screen readers and by the reserve panel. */
	fullKey: TranslationKey;
};

/** The seven columns of the grid, Monday to Sunday. */
export const WEEK_DAYS: readonly WeekDay[] = [
	{ shortKey: "schedule.mon", fullKey: "schedule.monFull" },
	{ shortKey: "schedule.tue", fullKey: "schedule.tueFull" },
	{ shortKey: "schedule.wed", fullKey: "schedule.wedFull" },
	{ shortKey: "schedule.thu", fullKey: "schedule.thuFull" },
	{ shortKey: "schedule.fri", fullKey: "schedule.friFull" },
	{ shortKey: "schedule.sat", fullKey: "schedule.satFull" },
	{ shortKey: "schedule.sun", fullKey: "schedule.sunFull" },
];

/** The name key of each practice. */
export const PRACTICE_NAME_KEYS: Readonly<Record<PracticeId, TranslationKey>> =
	{
		slowFlow: "practices.dawnTitle",
		matPilates: "practices.middayTitle",
		deepStretch: "practices.goldenTitle",
		breathwork: "practices.nightTitle",
		openPractice: "schedule.openPractice",
	};

/** One row of the grid: a start time, a practice, and a flag per day. */
type WeekRow = {
	/** Start time, 24-hour "HH:MM". Not translated: the page shows it as is. */
	time: string;
	practice: PracticeId;
	/** Seven flags, Monday first: true when the class runs that day. */
	days: readonly boolean[];
};

/** The rows of the week, in time order. 21 classes in all: the studio numbers say the same. */
export const WEEK_ROWS: readonly WeekRow[] = [
	{
		time: "06:30",
		practice: "slowFlow",
		days: [true, false, true, false, true, false, false],
	},
	{
		time: "07:15",
		practice: "matPilates",
		days: [false, true, false, true, false, false, false],
	},
	{
		time: "09:00",
		practice: "openPractice",
		days: [false, false, false, false, false, true, true],
	},
	{
		time: "12:15",
		practice: "matPilates",
		days: [true, true, true, true, true, true, false],
	},
	{
		time: "17:45",
		practice: "deepStretch",
		days: [true, true, false, true, false, false, false],
	},
	{
		time: "18:00",
		practice: "slowFlow",
		days: [false, false, true, false, true, false, false],
	},
	{
		time: "20:30",
		practice: "breathwork",
		days: [false, true, false, true, false, false, true],
	},
];

/** One class of the week: the index of its day in WEEK_DAYS (0 is Monday) and its start time. */
export type Session = { dayIndex: number; time: string };

/** The classes of one practice this week, by day, then by time. */
export function sessionsOf(practice: PracticeId): Session[] {
	const sessions: Session[] = [];
	for (const row of WEEK_ROWS) {
		if (row.practice !== practice) {
			continue;
		}
		row.days.forEach((runs, dayIndex) => {
			if (runs) {
				sessions.push({ dayIndex, time: row.time });
			}
		});
	}
	return sessions.sort(
		(first, second) =>
			first.dayIndex - second.dayIndex || first.time.localeCompare(second.time),
	);
}
