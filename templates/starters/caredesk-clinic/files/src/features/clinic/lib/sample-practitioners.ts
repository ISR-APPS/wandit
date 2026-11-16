// The practitioners of the practice: sample rows that stand in for the table `practitioners`.
// The appointment generator reads their shifts. Every page reads their names and rooms.
// To make it real: replace `listPractitioners` with a Supabase read in a query file.

/** The fields of care of the practice. The label is the message key `specialties.<specialty>`. */
export const SPECIALTIES = [
	"general_practice",
	"pediatrics",
	"dermatology",
	"physiotherapy",
	"nursing",
] as const;

/** One field of care. */
export type Specialty = (typeof SPECIALTIES)[number];

/** One working period of a day: the first and the last minute of the day, for example [480, 960] for 08:00 to 16:00. */
export type Shift = readonly [startMinute: number, endMinute: number];

/** One practitioner. */
export type Practitioner = {
	/** Stable id, also the value of the practitioner filters. */
	id: string;
	/** Name with the title, for example "Dr. Amara Okafor". */
	fullName: string;
	/** Letters after the name on a door plate, for example "MD". */
	credentials: string;
	specialty: Specialty;
	/** Where the practitioner sees patients, for example "Room 2". */
	room: string;
	/** Length of one booking slot, in minutes. */
	slotMinutes: number;
	/** The shift of each day of the week. Index 0 is Sunday, as in Date.getDay(). null is a day off. */
	shifts: readonly [
		Shift | null,
		Shift | null,
		Shift | null,
		Shift | null,
		Shift | null,
		Shift | null,
		Shift | null,
	];
	/** Share of the slots that get a booking on a normal day, from 0 to 1. Only the generator reads it. */
	fillRate: number;
	/** Internal phone extension of the room, for example "101". The practitioner card shows it. */
	extension: string;
	/** Languages of a consultation, as English names. The practitioner card shows them. */
	languages: readonly string[];
};

// Shifts in minutes of the day: 480 is 08:00, 720 is 12:00, 960 is 16:00, 1200 is 20:00.
const MORNING: Shift = [480, 960];
const EVENING: Shift = [720, 1200];
// The weekend clinic: 3 or 4 practitioners each morning, so a Saturday or a Sunday is a real working day.
// Every weekend shift ends at 1 PM or earlier, as STARTER.md says.
const SATURDAY_MORNING: Shift = [480, 750];

const PRACTITIONERS: readonly Practitioner[] = [
	{
		id: "okafor",
		fullName: "Dr. Amara Okafor",
		credentials: "MD",
		specialty: "general_practice",
		room: "Room 1",
		slotMinutes: 20,
		shifts: [
			null,
			MORNING,
			MORNING,
			MORNING,
			MORNING,
			MORNING,
			SATURDAY_MORNING,
		],
		fillRate: 0.32,
		extension: "101",
		languages: ["English", "French"],
	},
	{
		id: "solberg",
		fullName: "Dr. Henrik Solberg",
		credentials: "MD",
		specialty: "general_practice",
		room: "Room 2",
		slotMinutes: 20,
		shifts: [[540, 780], EVENING, EVENING, null, EVENING, EVENING, [540, 780]],
		fillRate: 0.3,
		extension: "102",
		languages: ["English", "Norwegian", "German"],
	},
	{
		id: "haddad",
		fullName: "Dr. Leila Haddad",
		credentials: "MD",
		specialty: "pediatrics",
		room: "Room 3",
		slotMinutes: 20,
		shifts: [
			[540, 780],
			[540, 1020],
			[540, 1020],
			[540, 1020],
			[540, 1020],
			null,
			null,
		],
		fillRate: 0.3,
		extension: "103",
		languages: ["English", "Arabic", "French"],
	},
	{
		id: "wrona",
		fullName: "Dr. Tomasz Wrona",
		credentials: "MD",
		specialty: "dermatology",
		room: "Room 4",
		slotMinutes: 30,
		shifts: [null, [600, 1080], null, [600, 1080], null, [600, 1080], null],
		fillRate: 0.4,
		extension: "104",
		languages: ["English", "Polish"],
	},
	{
		id: "carvalho",
		fullName: "Ines Carvalho",
		credentials: "PT",
		specialty: "physiotherapy",
		room: "Room 5",
		slotMinutes: 40,
		shifts: [
			null,
			null,
			[540, 1100],
			[540, 1100],
			[540, 1100],
			[540, 1100],
			[540, 780],
		],
		fillRate: 0.44,
		extension: "110",
		languages: ["English", "Portuguese", "Spanish"],
	},
	{
		id: "raman",
		fullName: "Priya Raman",
		credentials: "RN",
		specialty: "nursing",
		room: "Room 6",
		slotMinutes: 20,
		shifts: [
			[480, 750],
			MORNING,
			MORNING,
			null,
			MORNING,
			MORNING,
			SATURDAY_MORNING,
		],
		fillRate: 0.28,
		extension: "112",
		languages: ["English", "Tamil", "Hindi"],
	},
];

/** Every practitioner, in the order of the rooms. */
export function listPractitioners(): readonly Practitioner[] {
	return PRACTITIONERS;
}

/** The shift of `practitioner` on the local day of `ms`, or null on a day off. */
export function shiftOn(practitioner: Practitioner, ms: number): Shift | null {
	return practitioner.shifts[new Date(ms).getDay()] ?? null;
}
