// The posted week of Year 2 computing: five days, five time rows, one entry per cell.
// TimetableSection draws the whole week. DayVignette in the hero draws the Tuesday column.
// Course names and room lines are message keys of the `courses` group.
import type { TranslationKey } from "~/shared/i18n";

/** The course type. It picks the fill of the block and its legend chip. */
export type CourseKind =
	| "lecture"
	| "tutorial"
	| "lab"
	| "languages"
	| "optional";

/** One cell of the week grid: a course block, or an honest free slot. */
export type TimetableCell = {
	/** Stable React key, for example "sun-0830". */
	id: string;
	/** 0 is Sunday, 4 is Thursday: the Algerian school week. */
	day: number;
	/** Index in TIMETABLE_HOURS. */
	row: number;
	/** 2 for a block that covers the 13:00 and the 14:45 rows. */
	rowSpan: 1 | 2;
} & (
	| {
			kind: CourseKind;
			/** Key of the course name in the `courses` group. */
			titleKey: TranslationKey;
			/** Key of the room and duration line, for example "B12 · 1 h 30". */
			detailKey: TranslationKey;
	  }
	| { kind: "free" }
);

/** The start time of each row, 24-hour clock. */
export const TIMETABLE_HOURS = [
	"08:30",
	"10:15",
	"13:00",
	"14:45",
	"16:30",
] as const;

/** The five columns. `date` is the day of the month of the posted week. */
export const TIMETABLE_DAYS: readonly {
	labelKey: TranslationKey;
	date: number;
}[] = [
	{ labelKey: "timetable.sun", date: 8 },
	{ labelKey: "timetable.mon", date: 9 },
	{ labelKey: "timetable.tue", date: 10 },
	{ labelKey: "timetable.wed", date: 11 },
	{ labelKey: "timetable.thu", date: 12 },
];

/** Index of Tuesday 10, the day that the hero vignette shows. */
export const VIGNETTE_DAY = 2;

/** The legend order. Every kind here has at least one block in the week. */
export const COURSE_KINDS: readonly CourseKind[] = [
	"lecture",
	"tutorial",
	"lab",
	"languages",
	"optional",
];

/** Message key of the legend chip of each kind. */
export const COURSE_KIND_LABELS: Record<CourseKind, TranslationKey> = {
	lecture: "timetable.lecture",
	tutorial: "timetable.tutorial",
	lab: "timetable.lab",
	languages: "timetable.languages",
	optional: "timetable.optional",
};

/**
 * The week in row order, then day order. 27.5 supervised hours, 5 free slots, 3 optional sessions.
 * A row of a 2-row block has no entry of its own on that day.
 */
export const TIMETABLE_CELLS: readonly TimetableCell[] = [
	{
		id: "sun-0830",
		day: 0,
		row: 0,
		rowSpan: 1,
		kind: "lecture",
		titleKey: "courses.algorithms",
		detailKey: "courses.hallA2h",
	},
	{
		id: "mon-0830",
		day: 1,
		row: 0,
		rowSpan: 1,
		kind: "lecture",
		titleKey: "courses.databases",
		detailKey: "courses.hallA90",
	},
	{
		id: "tue-0830",
		day: 2,
		row: 0,
		rowSpan: 1,
		kind: "languages",
		titleKey: "courses.technicalEnglish",
		detailKey: "courses.c04Ninety",
	},
	{
		id: "wed-0830",
		day: 3,
		row: 0,
		rowSpan: 1,
		kind: "lecture",
		titleKey: "courses.algorithms",
		detailKey: "courses.hallA2h",
	},
	{
		id: "thu-0830",
		day: 4,
		row: 0,
		rowSpan: 1,
		kind: "lecture",
		titleKey: "courses.statistics",
		detailKey: "courses.b08Ninety",
	},

	{
		id: "sun-1015",
		day: 0,
		row: 1,
		rowSpan: 1,
		kind: "lab",
		titleKey: "courses.databasesLab",
		detailKey: "courses.lab1Two",
	},
	{ id: "mon-1015", day: 1, row: 1, rowSpan: 1, kind: "free" },
	{
		id: "tue-1015",
		day: 2,
		row: 1,
		rowSpan: 1,
		kind: "lecture",
		titleKey: "courses.networks",
		detailKey: "courses.b12Ninety",
	},
	{
		id: "wed-1015",
		day: 3,
		row: 1,
		rowSpan: 1,
		kind: "languages",
		titleKey: "courses.studyMethods",
		detailKey: "courses.b08Hour",
	},
	{
		id: "thu-1015",
		day: 4,
		row: 1,
		rowSpan: 1,
		kind: "lab",
		titleKey: "courses.tutoredProject",
		detailKey: "courses.lab2Two",
	},

	{
		id: "sun-1300",
		day: 0,
		row: 2,
		rowSpan: 2,
		kind: "lab",
		titleKey: "courses.webWorkshop",
		detailKey: "courses.lab2Long",
	},
	{
		id: "mon-1300",
		day: 1,
		row: 2,
		rowSpan: 1,
		kind: "tutorial",
		titleKey: "courses.databasesTutorial",
		detailKey: "courses.b12Ninety",
	},
	{
		id: "tue-1300",
		day: 2,
		row: 2,
		rowSpan: 2,
		kind: "lab",
		titleKey: "courses.tutoredProject",
		detailKey: "courses.lab1Long",
	},
	{ id: "wed-1300", day: 3, row: 2, rowSpan: 1, kind: "free" },
	{
		id: "thu-1300",
		day: 4,
		row: 2,
		rowSpan: 1,
		kind: "lecture",
		titleKey: "courses.projectManagement",
		detailKey: "courses.b08Ninety",
	},

	{
		id: "mon-1445",
		day: 1,
		row: 3,
		rowSpan: 1,
		kind: "tutorial",
		titleKey: "courses.networksTutorial",
		detailKey: "courses.b12Ninety",
	},
	{
		id: "wed-1445",
		day: 3,
		row: 3,
		rowSpan: 1,
		kind: "tutorial",
		titleKey: "courses.statisticsTutorial",
		detailKey: "courses.b08Ninety",
	},
	{ id: "thu-1445", day: 4, row: 3, rowSpan: 1, kind: "free" },

	{ id: "sun-1630", day: 0, row: 4, rowSpan: 1, kind: "free" },
	{
		id: "mon-1630",
		day: 1,
		row: 4,
		rowSpan: 1,
		kind: "optional",
		titleKey: "courses.openTutoring",
		detailKey: "courses.b08SignUp",
	},
	{ id: "tue-1630", day: 2, row: 4, rowSpan: 1, kind: "free" },
	{
		id: "wed-1630",
		day: 3,
		row: 4,
		rowSpan: 1,
		kind: "optional",
		titleKey: "courses.sport",
		detailKey: "courses.gymOptional",
	},
	{
		id: "thu-1630",
		day: 4,
		row: 4,
		rowSpan: 1,
		kind: "optional",
		titleKey: "courses.careerTalk",
		detailKey: "courses.hallAOptional",
	},
];
