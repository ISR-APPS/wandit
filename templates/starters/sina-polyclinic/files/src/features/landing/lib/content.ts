// The fixed lists of the Sina Polyclinic page: ids, numbers, and slot times.
// The section components read these lists and resolve each text with t().
// The texts themselves are in src/shared/i18n/messages.ts, in the group of each section.
import type { TranslationKey } from "~/shared/i18n";

// One link of the header, the phone menu, and the footer.
type NavLink = {
	/** The id of a section element of the page, with its "#". */
	href: string;
	label: TranslationKey;
};

/** The section links in page order. The header shows them from 1080px, and the phone menu below that. */
export const NAV_LINKS: readonly NavLink[] = [
	{ href: "#specialties", label: "site.navSpecialties" },
	{ href: "#practitioners", label: "site.navPractitioners" },
	{ href: "#oath", label: "site.navOath" },
	{ href: "#access", label: "site.navAccess" },
	{ href: "#questions", label: "site.navQuestions" },
];

/** The anchor of the booking section. The header, the hero, the phone menu, and the footer link to it. */
export const BOOKING_HREF = "#booking";

/** The id of a row of the fee register. It is also the key of its text group `specialties.<id>`. */
export type SpecialtyId =
	| "general"
	| "cardiology"
	| "pediatrics"
	| "gynecology"
	| "dermatology"
	| "ophthalmology"
	| "imaging"
	| "laboratory"
	| "physiotherapy";

/** The nine rows of the register, in the order of the board at the front desk. */
export const SPECIALTY_IDS: readonly SpecialtyId[] = [
	"general",
	"cardiology",
	"pediatrics",
	"gynecology",
	"dermatology",
	"ophthalmology",
	"imaging",
	"laboratory",
	"physiotherapy",
];

/** One counted figure of the deep band. */
export type CountedFigure = {
	/** The key of its text group `figures.<id>`. */
	id: "patients" | "years" | "specialties" | "analyses";
	/** The figure of the front desk register, a whole number. */
	total: number;
};

/** The four figures in the order of the four beats of the trace above them. */
export const COUNTED_FIGURES: readonly CountedFigure[] = [
	{ id: "patients", total: 12400 },
	{ id: "years", total: 18 },
	{ id: "specialties", total: 9 },
	{ id: "analyses", total: 4500 },
];

/** The id of a practitioner card. It is also the key of its text group `team.<id>`. */
export type PractitionerId = "belhadj" | "merabet" | "bouzid" | "khelifi";

/** The four cards in grid order: two beside the photo, two under it. */
export const PRACTITIONER_IDS: readonly PractitionerId[] = [
	"belhadj",
	"merabet",
	"bouzid",
	"khelifi",
];

// The id of a commitment. It is also the key of its text group `oath.<id>`.
type CommitmentId = "time" | "fee" | "record" | "prescription" | "doubt";

/** The five commitments in the order of a visit: from the call to the diagnosis. */
export const COMMITMENT_IDS: readonly CommitmentId[] = [
	"time",
	"fee",
	"record",
	"prescription",
	"doubt",
];

/** The id of a day of the slot picker. It is also the key of its text group `booking.days.<id>`. */
export type BookingDayId =
	| "sunday"
	| "monday"
	| "tuesday"
	| "wednesday"
	| "thursday"
	| "saturday";

/** One slot of a consulting day. */
export type Slot = {
	/** The start time on a 24-hour clock, "HH:MM". It is the value of the radio input. */
	time: string;
	/** A full slot shows struck through, and the visitor cannot pick it. */
	isFull: boolean;
};

/** Builds the slots of one day. Each time in `fullTimes` is a slot that is already taken. */
function slotsOf(
	times: readonly string[],
	fullTimes: readonly string[],
): Slot[] {
	return times.map((time) => ({ time, isFull: fullTimes.includes(time) }));
}

// A half day has eight slots of 30 minutes.
const MORNING_TIMES = [
	"08:00",
	"08:30",
	"09:00",
	"09:30",
	"10:00",
	"10:30",
	"11:00",
	"11:30",
];

// The six days that the front desk opens for requests, in week order from Sunday. Friday is closed.
const BOOKING_DAY_IDS: readonly BookingDayId[] = [
	"sunday",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"saturday",
];

/**
 * The days on which each specialty consults, in week order. They agree with `team.<id>.days` and `team.rosterDays`.
 * The laboratory receives walk-in patients, so it has no day and no slot.
 */
export const BOOKING_DAYS_BY_SPECIALTY: Record<
	SpecialtyId,
	readonly BookingDayId[]
> = {
	general: ["sunday", "monday", "tuesday", "wednesday", "thursday"],
	cardiology: ["sunday", "tuesday", "saturday"],
	pediatrics: ["sunday", "monday", "thursday"],
	gynecology: ["monday", "wednesday", "saturday"],
	dermatology: ["monday", "thursday"],
	ophthalmology: ["tuesday", "wednesday"],
	imaging: BOOKING_DAY_IDS,
	laboratory: [],
	physiotherapy: ["sunday", "monday", "tuesday", "wednesday", "thursday"],
};

/** The specialties of the slot picker: each specialty with at least one consulting day. */
export const BOOKABLE_SPECIALTY_IDS: readonly SpecialtyId[] =
	SPECIALTY_IDS.filter((id) => BOOKING_DAYS_BY_SPECIALTY[id].length > 0);

/** The slots of each day in clock order. A whole day has twelve slots, and each day has slots that are full. */
export const BOOKING_SLOTS: Record<BookingDayId, readonly Slot[]> = {
	sunday: slotsOf(
		[
			"08:30",
			"09:00",
			"09:30",
			"10:00",
			"10:30",
			"11:00",
			"13:30",
			"14:00",
			"14:30",
			"15:00",
			"16:00",
			"17:30",
		],
		["09:00", "10:30", "14:30"],
	),
	monday: slotsOf(MORNING_TIMES, ["08:00", "09:30", "11:00"]),
	tuesday: slotsOf(
		[
			"08:30",
			"09:00",
			"09:30",
			"10:00",
			"11:00",
			"11:30",
			"13:30",
			"14:00",
			"15:00",
			"15:30",
			"16:30",
			"17:00",
		],
		["08:30", "09:30", "14:00", "17:00"],
	),
	wednesday: slotsOf(
		["13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:30"],
		["14:30", "15:30"],
	),
	thursday: slotsOf(MORNING_TIMES, ["09:00", "10:30"]),
	// Saturday consultations run from 08:00 to 18:00, as `access.saturdayHours` and the FAQ say.
	saturday: slotsOf(
		[
			"08:00",
			"08:30",
			"09:00",
			"10:00",
			"10:30",
			"11:30",
			"13:30",
			"14:00",
			"15:00",
			"15:30",
			"16:30",
			"17:30",
		],
		["08:30", "10:00", "14:00", "16:30"],
	),
};

// The id of a question. It is also the key of its text group `faq.<id>`.
type QuestionId =
	| "analyses"
	| "insurance"
	| "parking"
	| "saturday"
	| "report"
	| "emergency";

/** The questions of the two FAQ columns. The first question of each column is open at page load. */
export const QUESTION_COLUMNS: readonly (readonly QuestionId[])[] = [
	["analyses", "insurance", "parking"],
	["saturday", "report", "emergency"],
];
