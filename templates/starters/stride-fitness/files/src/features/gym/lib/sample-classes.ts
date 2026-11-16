// The coaches, the class types, and the weekly timetable of the gym.
// This module stands in for the `coaches`, `class_types`, and `timetable_slots` tables.
// sample-activity.ts turns the timetable into dated sessions. The pages read it through ~/features/gym.

/** One coach of the gym. The names are fictional. */
export type Coach = {
	id: string;
	fullName: string;
};

/** The six coaches. */
export const COACHES: readonly Coach[] = [
	{ id: "c-kemi", fullName: "Kemi Adeyemi" },
	{ id: "c-rafa", fullName: "Rafa Ortega" },
	{ id: "c-jonas", fullName: "Jonas Brandt" },
	{ id: "c-mira", fullName: "Mira Castell" },
	{ id: "c-theo", fullName: "Theo Nakamura" },
	{ id: "c-ana", fullName: "Ana Duarte" },
];

/** Every class type id, in the order of the class lists. */
export const CLASS_TYPE_IDS = [
	"hiit",
	"spin",
	"strength",
	"flow",
	"boxing",
	"mobility",
	"kettlebell",
	"engine",
] as const;

/** One class type id. */
export type ClassTypeId = (typeof CLASS_TYPE_IDS)[number];

/** One kind of class on the timetable. */
export type ClassType = {
	id: ClassTypeId;
	/** The class name on the timetable. Data, not a UI text. */
	name: string;
	/** Length of one session, in minutes. */
	minutes: number;
	/** Spots of one session: bikes, rowers, or floor places. */
	capacity: number;
	/** The room of the class. Data, not a UI text. */
	studio: string;
	/** Id of the coach in COACHES. */
	coachId: string;
	/** Share of the spots that members book at a usual hour, from 0 to 1. Demand above 1 fills a waitlist. */
	popularity: number;
};

/** The eight class types. */
export const CLASS_TYPES: readonly ClassType[] = [
	{
		id: "hiit",
		name: "HIIT Circuit",
		minutes: 45,
		capacity: 14,
		studio: "Main Floor",
		coachId: "c-kemi",
		popularity: 0.86,
	},
	{
		id: "spin",
		name: "Spin 45",
		minutes: 45,
		capacity: 16,
		studio: "Cycle Room",
		coachId: "c-rafa",
		popularity: 0.82,
	},
	{
		id: "strength",
		name: "Strength Lab",
		minutes: 60,
		capacity: 10,
		studio: "Main Floor",
		coachId: "c-jonas",
		popularity: 0.88,
	},
	{
		id: "flow",
		name: "Vinyasa Flow",
		minutes: 60,
		capacity: 16,
		studio: "Mat Room",
		coachId: "c-mira",
		popularity: 0.7,
	},
	{
		id: "boxing",
		name: "Boxing Conditioning",
		minutes: 50,
		capacity: 12,
		studio: "Studio Two",
		coachId: "c-theo",
		popularity: 0.84,
	},
	{
		id: "mobility",
		name: "Mobility & Stretch",
		minutes: 30,
		capacity: 12,
		studio: "Mat Room",
		coachId: "c-mira",
		popularity: 0.55,
	},
	{
		id: "kettlebell",
		name: "Kettlebell Club",
		minutes: 45,
		capacity: 10,
		studio: "Studio Two",
		coachId: "c-ana",
		popularity: 0.74,
	},
	{
		id: "engine",
		name: "Row & Ride",
		minutes: 45,
		capacity: 12,
		studio: "Cycle Room",
		coachId: "c-ana",
		popularity: 0.66,
	},
];

/** The four rooms, in the order of the studio filter. Each class type names one of them. */
export const STUDIOS = [
	"Main Floor",
	"Cycle Room",
	"Studio Two",
	"Mat Room",
] as const;

/** One weekly session of the timetable. */
export type TimetableSlot = {
	/** Day of the week as Date.getDay() gives it: 0 is Sunday, 6 is Saturday. */
	weekday: number;
	/** Start time as minutes after midnight: 390 is 06:30. */
	startMinute: number;
	classTypeId: ClassTypeId;
};

// [weekday, "HH:MM", class type]. A compact form of the weekly timetable.
const WEEK: readonly [number, string, ClassTypeId][] = [
	[1, "06:30", "hiit"],
	[1, "07:30", "spin"],
	[1, "09:30", "flow"],
	[1, "12:15", "mobility"],
	[1, "17:30", "strength"],
	[1, "18:30", "spin"],
	[1, "19:30", "boxing"],
	[2, "06:30", "spin"],
	[2, "07:30", "strength"],
	[2, "09:30", "kettlebell"],
	[2, "12:15", "hiit"],
	[2, "17:30", "boxing"],
	[2, "18:30", "flow"],
	[2, "19:30", "engine"],
	[3, "06:30", "hiit"],
	[3, "07:30", "engine"],
	[3, "09:30", "flow"],
	[3, "12:15", "spin"],
	[3, "17:30", "kettlebell"],
	[3, "18:30", "hiit"],
	[3, "19:30", "mobility"],
	[4, "06:30", "spin"],
	[4, "07:30", "strength"],
	[4, "09:30", "mobility"],
	[4, "12:15", "boxing"],
	[4, "17:30", "spin"],
	[4, "18:30", "strength"],
	[4, "19:30", "flow"],
	[5, "06:30", "hiit"],
	[5, "07:30", "kettlebell"],
	[5, "09:30", "flow"],
	[5, "12:15", "engine"],
	[5, "17:00", "boxing"],
	[5, "18:00", "spin"],
	[6, "08:00", "spin"],
	[6, "09:00", "hiit"],
	[6, "10:15", "flow"],
	[6, "11:30", "boxing"],
	[6, "15:00", "kettlebell"],
	[6, "16:30", "mobility"],
	[0, "09:00", "flow"],
	[0, "10:15", "strength"],
	[0, "11:30", "spin"],
	[0, "16:00", "mobility"],
	[0, "17:15", "engine"],
];

/** The weekly timetable: 45 sessions, 7 on most weekdays, 6 on Friday and Saturday, 5 on Sunday. */
export const TIMETABLE: readonly TimetableSlot[] = WEEK.map(
	([weekday, time, classTypeId]) => {
		const [hours = 0, minutes = 0] = time.split(":").map(Number);
		return { weekday, startMinute: hours * 60 + minutes, classTypeId };
	},
);

/** The class type of an id. Every ClassTypeId has a row, so the result is never undefined. */
export function classTypeOf(id: ClassTypeId): ClassType {
	const classType = CLASS_TYPES.find((row) => row.id === id);
	if (!classType) {
		throw new Error(`Unknown class type id: ${id}`);
	}
	return classType;
}

/** The coach of a class type. Each `coachId` of CLASS_TYPES is in COACHES, so it throws only on a typo. */
export function coachOf(id: string): Coach {
	const coach = COACHES.find((row) => row.id === id);
	if (!coach) {
		throw new Error(`Unknown coach id: ${id}`);
	}
	return coach;
}
