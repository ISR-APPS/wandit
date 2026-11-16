// The appointment book of the practice: sample rows that stand in for the table `appointments`.
// A seeded generator plans every visit from 90 days back to 14 days ahead. The seed of a day is its calendar date.
// A doctor sees a patient again only after 14 days. That rule reads the earlier days, so the next day can move a few past visits.
// `listAppointments(now)` then gives each row the status that the clock gives it. A later visit never has a past event.

import {
	type AppointmentStatus,
	isUpcomingStatus,
	type VisitType,
} from "./appointment-status";
import {
	addDays,
	atMinute,
	daysBetween,
	epochDay,
	MINUTE_MS,
	startOfLocalDay,
} from "./clinic-day";
import { listPatientPlans, type PatientPlan } from "./sample-patients";
import {
	listPractitioners,
	type Practitioner,
	type Specialty,
} from "./sample-practitioners";
import {
	createSeededRandom,
	hashShare,
	pickOne,
	pickWeightedIndex,
	type Random,
	randomInt,
} from "./seeded-random";

/** Days of history in the book. The trend chart shows at most this period. */
export const BOOK_PAST_DAYS = 90;
/** Days that patients can book ahead. */
export const BOOK_FUTURE_DAYS = 14;
/** Minutes after the start time when the front desk records a no-show. */
export const NO_SHOW_AFTER_MINUTES = 15;
// The older visit of a file with no visit in the book stays on one calendar day for this count of days.
const OLD_VISIT_CYCLE_DAYS = 210;
// A doctor sees one patient again only after 14 days. Physiotherapy and nursing keep their own rhythm.
const DOCTOR_VISIT_GAP_DAYS = 14;
const GAP_SPECIALTIES: ReadonlySet<Specialty> = new Set([
	"general_practice",
	"pediatrics",
	"dermatology",
]);

/** One appointment, as the pages read it. Every time is in milliseconds since 1970. */
export type Appointment = {
	/** Stable id, for example "apt-1113-07": the month, the day, and a counter of that day. */
	id: string;
	patientId: string;
	practitionerId: string;
	/** The planned start. */
	startsAt: number;
	/** The planned length, in minutes: one slot of the practitioner. */
	durationMinutes: number;
	visitType: VisitType;
	/** The reason that the patient gave at the booking, in plain words. */
	reason: string;
	/** The room of the practitioner, for example "Room 2". */
	room: string;
	status: AppointmentStatus;
	/** When the front desk made the booking. */
	bookedAt: number;
	/** When the patient confirmed the reminder, or null. */
	confirmedAt: number | null;
	/** When the patient arrived at the front desk, or null. */
	checkedInAt: number | null;
	/** When the consultation started, or null. */
	startedAt: number | null;
	/** When the consultation ended, or null. */
	endedAt: number | null;
	/** When the patient cancelled, or null. */
	cancelledAt: number | null;
};

// One planned visit. The generator knows how it ends; `toAppointment` shows only what the clock allows.
type AppointmentPlan = {
	id: string;
	patientId: string;
	practitionerId: string;
	startsAt: number;
	durationMinutes: number;
	visitType: VisitType;
	reason: string;
	room: string;
	outcome: "completed" | "no_show" | "cancelled";
	bookedAt: number;
	confirmAt: number | null;
	cancelAt: number | null;
	arrivalAt: number;
	consultStartAt: number;
	consultEndAt: number;
};

// The visit types of each specialty with their weights, and the reasons of each type.
const VISIT_MIX: Record<
	Specialty,
	readonly {
		type: VisitType;
		weight: number;
		reasons: readonly [string, ...string[]];
	}[]
> = {
	general_practice: [
		{
			type: "consultation",
			weight: 50,
			reasons: [
				"Persistent cough",
				"Lower back pain",
				"Recurring headaches",
				"Sore throat and fever",
				"Fatigue",
				"Seasonal allergies",
				"Stomach pain",
				"Trouble sleeping",
				"Dizziness",
				"Knee pain",
			],
		},
		{
			type: "follow_up",
			weight: 30,
			// A patient with a long-term condition gets a follow-up of CONDITION_FOLLOW_UPS in place of these.
			reasons: ["Blood test results", "Medication review"],
		},
		{
			type: "check_up",
			weight: 20,
			reasons: [
				"Annual check-up",
				"Pre-employment check-up",
				"Sports medical certificate",
				"Travel health advice",
			],
		},
	],
	pediatrics: [
		{
			type: "consultation",
			weight: 45,
			reasons: [
				"Ear pain",
				"Fever since yesterday",
				"Cough at night",
				"Skin rash",
				"Stomach ache",
				"Sore throat",
			],
		},
		{
			type: "check_up",
			weight: 30,
			reasons: [
				"Well-child visit",
				"Growth and weight check",
				"School health form",
			],
		},
		{
			type: "vaccination",
			weight: 25,
			reasons: ["Routine childhood vaccines", "Booster dose", "Flu vaccine"],
		},
	],
	dermatology: [
		{
			type: "consultation",
			weight: 45,
			reasons: [
				"Mole check",
				"Eczema flare",
				"Persistent rash",
				"Hair loss",
				"Itchy scalp",
			],
		},
		{
			type: "follow_up",
			weight: 30,
			reasons: ["Acne follow-up", "Psoriasis review", "Biopsy results"],
		},
		{
			type: "procedure",
			weight: 25,
			reasons: ["Wart removal", "Skin tag removal", "Mole removal"],
		},
	],
	physiotherapy: [
		{
			type: "therapy",
			weight: 100,
			reasons: [
				"Knee rehabilitation",
				"Shoulder mobility",
				"Lower back program",
				"Post-surgery rehabilitation",
				"Neck tension",
				"Ankle sprain recovery",
				"Hip strengthening",
			],
		},
	],
	nursing: [
		{
			type: "procedure",
			weight: 40,
			reasons: [
				"Blood draw",
				"Dressing change",
				"Suture removal",
				"B12 injection",
				"Ear irrigation",
			],
		},
		{
			type: "vaccination",
			weight: 35,
			reasons: ["Flu vaccine", "Travel vaccines", "Tetanus booster"],
		},
		{
			type: "follow_up",
			weight: 25,
			reasons: ["Wound check", "Blood pressure check"],
		},
	],
};

// The follow-up of each long-term condition (the names of sample-patients.ts), for the specialties that check it.
// A follow-up names a condition of the patient, so a file never shows a check for a condition that it does not list.
const CONDITION_FOLLOW_UPS: Partial<
	Record<Specialty, ReadonlyMap<string, string>>
> = {
	general_practice: new Map([
		["Hypertension", "Blood pressure follow-up"],
		["Type 2 diabetes", "Diabetes follow-up"],
		["Asthma", "Asthma review"],
		["Hypothyroidism", "Thyroid follow-up"],
		["Migraine", "Migraine review"],
		["High cholesterol", "Cholesterol results"],
		["Osteoarthritis", "Joint pain review"],
	]),
	nursing: new Map([
		["Hypertension", "Blood pressure check"],
		["Type 2 diabetes", "Blood sugar check"],
	]),
};

// Monday is the busiest weekday and Friday the calmest. Index 0 is Sunday, as in Date.getDay().
// The short weekend clinic fills up most: patients who work in the week come then.
const WEEKDAY_DEMAND = [1.3, 1.14, 1.02, 1.06, 0.98, 0.9, 1.3];

// The share of a normal day that is booked `dayOffset` days from today.
// The practice grew by 16 % in 90 days. A day far ahead is not full yet.
function demandFactor(dayOffset: number): number {
	if (dayOffset <= 0) {
		return 1 - 0.16 * (-dayOffset / BOOK_PAST_DAYS);
	}
	if (dayOffset <= 1) {
		return 0.95;
	}
	if (dayOffset <= 3) {
		return 0.85;
	}
	if (dayOffset <= 7) {
		return 0.7;
	}
	return dayOffset <= 10 ? 0.5 : 0.35;
}

// The share of the bookings that end as a no-show. Reminders brought it from 7 % down to 5.6 % in 90 days.
function noShowRate(dayOffset: number): number {
	return 0.056 + 0.014 * (Math.max(0, -dayOffset) / BOOK_PAST_DAYS);
}

// The start minutes of the slots of one shift. A long shift that starts in the morning has a lunch break.
function slotStarts(practitioner: Practitioner, dayStart: number): number[] {
	const shift = practitioner.shifts[new Date(dayStart).getDay()];
	if (!shift) {
		return [];
	}
	const [startMinute, endMinute] = shift;
	const hasLunch = endMinute - startMinute >= 420 && startMinute <= 600;
	const starts: number[] = [];
	for (
		let minute = startMinute;
		minute + practitioner.slotMinutes <= endMinute;
		minute += practitioner.slotMinutes
	) {
		// 12:30 to 13:20 stays free.
		if (!(hasLunch && minute >= 750 && minute < 800)) {
			starts.push(minute);
		}
	}
	return starts;
}

// True when `practitioner` can see `patient`: the own patients of a doctor, a program, or anybody for the nurse.
function canSee(practitioner: Practitioner, patient: PatientPlan): boolean {
	switch (practitioner.specialty) {
		case "general_practice":
		case "pediatrics":
			return patient.primaryPractitionerId === practitioner.id;
		case "dermatology":
			return patient.hasSkinCare;
		case "physiotherapy":
			return patient.isInTherapy;
		case "nursing":
			return true;
	}
}

// `count` different items of `items`, in a random order (the first steps of a Fisher-Yates shuffle).
function drawSome(
	random: Random,
	items: readonly number[],
	count: number,
): number[] {
	const pool = [...items];
	const drawn: number[] = [];
	while (drawn.length < count && pool.length > 0) {
		const [item] = pool.splice(Math.floor(random() * pool.length), 1);
		if (item !== undefined) {
			drawn.push(item);
		}
	}
	return drawn;
}

// The patient of one slot: of the patients with a weight above 0, the one with the highest key.
// The key share ** (1 / weight) picks each patient in proportion to its weight. Each key depends only on
// the slot and the patient, so a change of one patient (a new file, a first visit) moves no other pick.
function pickPatient(slotSeed: number, weights: readonly number[]): number {
	let picked = -1;
	let pickedKey = -1;
	for (const [index, weight] of weights.entries()) {
		if (weight <= 0) {
			continue;
		}
		const key = hashShare(slotSeed, index) ** (1 / weight);
		if (key > pickedKey) {
			picked = index;
			pickedKey = key;
		}
	}
	return picked;
}

// The month and the day of `ms` as four digits, for the id of an appointment.
function monthDay(ms: number): string {
	const date = new Date(ms);
	return `${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

type PlanInput = {
	random: Random;
	patient: PatientPlan;
	patientIndex: number;
	practitioner: Practitioner;
	startsAt: number;
	isFirstVisit: boolean;
	/** True when the patient does not come. The book spreads the no-shows evenly, as a real month does. */
	isNoShow: boolean;
	/** The end of the earlier consultation of the practitioner on that day. The next one starts after it. */
	roomFreeAt: number;
	/** Day offset of the visit from today. */
	dayOffset: number;
	todayStart: number;
	id: string;
};

// Plans one visit: its type, how it ends, and the time of each step.
function planVisit(input: PlanInput): AppointmentPlan {
	const { random, patient, practitioner, startsAt, dayOffset, todayStart } =
		input;
	const mix = VISIT_MIX[practitioner.specialty];
	const kind =
		mix[
			pickWeightedIndex(
				random,
				mix.map((item) => item.weight),
			)
		] ?? mix[0];
	const reasons = kind?.reasons ?? ["Consultation"];
	const [firstFollowUp, ...otherFollowUps] = patient.conditions.flatMap(
		(condition) =>
			CONDITION_FOLLOW_UPS[practitioner.specialty]?.get(condition) ?? [],
	);
	// A therapy patient keeps one program for every session.
	const reason =
		kind?.type === "therapy"
			? (reasons[input.patientIndex % reasons.length] ?? reasons[0])
			: kind?.type === "follow_up" && firstFollowUp !== undefined
				? pickOne(random, [firstFollowUp, ...otherFollowUps])
				: pickOne(random, reasons);
	// 7 % of the patients who come cancel first.
	const cancelDraw = random();
	const outcome = input.isNoShow
		? "no_show"
		: cancelDraw < 0.07
			? "cancelled"
			: "completed";

	// A booking is always in the past: 1 to 21 days before the visit, and before today.
	const bookedDay = addDays(
		todayStart,
		Math.min(dayOffset, 0) - randomInt(random, 1, 21),
	);
	const plannedBookedAt = atMinute(bookedDay, randomInt(random, 510, 1050));
	// The file opens before the first booking. The first visit is booked when the file opens.
	const bookedAt = input.isFirstVisit
		? patient.registeredAt
		: Math.max(plannedBookedAt, patient.registeredAt + 60 * MINUTE_MS);

	// 12 % of the patients never answer the reminder. The others confirm 1 to 3 days before.
	const confirmDraw = random();
	const plannedConfirmAt = atMinute(
		addDays(todayStart, dayOffset - randomInt(random, 1, 3)),
		randomInt(random, 540, 1080),
	);
	const confirmAt =
		confirmDraw < 0.12
			? null
			: Math.max(plannedConfirmAt, bookedAt + 60 * MINUTE_MS);

	// A patient cancels 1 to 4 days before, never on the day itself: the rows of today do not change status this way.
	const plannedCancelAt = atMinute(
		addDays(todayStart, dayOffset - randomInt(random, 1, 4)),
		randomInt(random, 510, 1050),
	);
	const cancelAt =
		outcome === "cancelled"
			? Math.max(plannedCancelAt, bookedAt + 120 * MINUTE_MS)
			: null;

	// 4 of 5 patients arrive 2 to 15 minutes early. The others arrive 1 to 7 minutes late.
	const arrivalMinutes =
		random() < 0.8 ? -randomInt(random, 2, 15) : randomInt(random, 1, 7);
	const arrivalAt = startsAt + arrivalMinutes * MINUTE_MS;
	const consultStartAt =
		Math.max(startsAt, arrivalAt, input.roomFreeAt) +
		randomInt(random, 0, 9) * MINUTE_MS;
	// Most consultations end 2 to 6 minutes before the end of the slot.
	const consultEndAt =
		consultStartAt +
		(practitioner.slotMinutes - randomInt(random, 2, 6)) * MINUTE_MS;

	return {
		id: input.id,
		patientId: patient.id,
		practitionerId: practitioner.id,
		startsAt,
		durationMinutes: practitioner.slotMinutes,
		visitType: input.isFirstVisit
			? "first_visit"
			: (kind?.type ?? "consultation"),
		reason: input.isFirstVisit ? "New patient intake" : reason,
		room: practitioner.room,
		outcome,
		bookedAt,
		confirmAt,
		cancelAt,
		arrivalAt,
		consultStartAt,
		consultEndAt,
	};
}

// Every planned visit of the book, oldest first.
function buildBook(todayStart: number): AppointmentPlan[] {
	const patients = listPatientPlans(todayStart);
	const practitioners = listPractitioners();
	const plans: AppointmentPlan[] = [];
	// Days since 1970 of today. A day of the book uses its own date as the seed, not its offset from today.
	const todayEpochDay = epochDay(todayStart);
	const visitCounts = patients.map(() => 0);
	// The day offset of the last booking of each pair "practitioner id:patient index", for the gap of a doctor.
	const lastBookedDay = new Map<string, number>();
	const dayCounters = new Map<number, number>();
	const nextId = (dayStart: number): string => {
		const counter = (dayCounters.get(dayStart) ?? 0) + 1;
		dayCounters.set(dayStart, counter);
		return `apt-${monthDay(dayStart)}-${String(counter).padStart(2, "0")}`;
	};

	// The share of a no-show grows by the rate of each booking. At 1 the patient does not come.
	// So the no-shows spread evenly over a day, and two periods of 7 days differ little by chance alone.
	// Each day starts its share again from its date, so the no-shows of an older day do not move.
	let noShowShare = 0;
	const takeNoShow = (dayOffset: number): boolean => {
		noShowShare += noShowRate(dayOffset);
		if (noShowShare < 1) {
			return false;
		}
		noShowShare -= 1;
		return true;
	};

	// The first visit of each new patient, on a working day of the practitioner who follows the patient.
	const firstVisitDays = new Map<number, number>();
	const firstVisits = new Map<string, number[]>();
	for (const [patientIndex, patient] of patients.entries()) {
		const practitioner = practitioners.find(
			(item) => item.id === patient.primaryPractitionerId,
		);
		if (patient.firstVisitOffset === null || !practitioner) {
			continue;
		}
		let dayOffset = patient.firstVisitOffset;
		// At most 6 steps: every practitioner works on 2 days of the week or more.
		while (
			slotStarts(practitioner, addDays(todayStart, dayOffset)).length === 0
		) {
			dayOffset += 1;
		}
		firstVisitDays.set(patientIndex, dayOffset);
		const key = `${dayOffset}:${practitioner.id}`;
		firstVisits.set(key, [...(firstVisits.get(key) ?? []), patientIndex]);
	}

	for (
		let dayOffset = -BOOK_PAST_DAYS;
		dayOffset <= BOOK_FUTURE_DAYS;
		dayOffset += 1
	) {
		const dayStart = addDays(todayStart, dayOffset);
		const epochDay = todayEpochDay + dayOffset;
		// 0.618 (the golden ratio) spreads the start shares of the following days evenly from 0 to 1.
		noShowShare = (epochDay * 0.618_034) % 1;
		const bookedToday = new Set<number>();
		for (const [practitionerIndex, practitioner] of practitioners.entries()) {
			const starts = slotStarts(practitioner, dayStart);
			if (starts.length === 0) {
				continue;
			}
			// One seed for each calendar day and practitioner. 64 keeps the seeds of two days apart.
			const daySeed = 90_000 + (epochDay % 100_000) * 64 + practitionerIndex;
			const random = createSeededRandom(daySeed);
			const newPatients =
				firstVisits.get(`${dayOffset}:${practitioner.id}`) ?? [];
			const demand =
				starts.length *
				practitioner.fillRate *
				(WEEKDAY_DEMAND[new Date(dayStart).getDay()] ?? 1) *
				demandFactor(dayOffset) *
				(0.85 + random() * 0.3);
			const count = Math.min(
				starts.length,
				Math.max(1, newPatients.length, Math.round(demand)),
			);
			const drawnStarts = drawSome(random, starts, count);
			// The first drawn slots go to the new patients. The other slots go to patients that the weights pick.
			const newPatientOfStart = new Map(
				newPatients.map(
					(patientIndex, index) => [drawnStarts[index], patientIndex] as const,
				),
			);
			let roomFreeAt = 0;
			for (const startMinute of [...drawnStarts].sort(
				(first, second) => first - second,
			)) {
				const forcedIndex = newPatientOfStart.get(startMinute);
				const patientIndex =
					forcedIndex ??
					pickPatient(
						// 1440 minutes in a day: each slot of the day gets its own seed.
						daySeed * 1440 + startMinute,
						patients.map((patient, index) => {
							const firstVisitDay = firstVisitDays.get(index);
							const lastDay = lastBookedDay.get(`${practitioner.id}:${index}`);
							const isTooSoon =
								GAP_SPECIALTIES.has(practitioner.specialty) &&
								lastDay !== undefined &&
								dayOffset - lastDay < DOCTOR_VISIT_GAP_DAYS;
							const isFree =
								!bookedToday.has(index) &&
								!isTooSoon &&
								canSee(practitioner, patient) &&
								// A new patient comes back only after the first visit.
								(firstVisitDay === undefined || dayOffset > firstVisitDay);
							if (!isFree) {
								return 0;
							}
							// A program gives each of its patients the same count of sessions.
							return practitioner.specialty === "physiotherapy"
								? 1
								: patient.visitWeight;
						}),
					);
				const patient = patients[patientIndex];
				if (!patient) {
					continue;
				}
				bookedToday.add(patientIndex);
				lastBookedDay.set(`${practitioner.id}:${patientIndex}`, dayOffset);
				visitCounts[patientIndex] = (visitCounts[patientIndex] ?? 0) + 1;
				const plan = planVisit({
					random,
					patient,
					patientIndex,
					practitioner,
					startsAt: atMinute(dayStart, startMinute),
					isFirstVisit: forcedIndex !== undefined,
					isNoShow: takeNoShow(dayOffset),
					roomFreeAt,
					dayOffset,
					todayStart,
					id: nextId(dayStart),
				});
				if (plan.outcome === "completed") {
					roomFreeAt = plan.consultEndAt;
				}
				plans.push(plan);
			}
		}
	}

	// A patient with no visit in the book gets one older visit, so every file has a last visit.
	const takenSlots = new Set<string>();
	for (const [patientIndex, patient] of patients.entries()) {
		const practitioner = practitioners.find(
			(item) => item.id === patient.primaryPractitionerId,
		);
		if ((visitCounts[patientIndex] ?? 0) > 0 || !practitioner) {
			continue;
		}
		const random = createSeededRandom(700_000 + patientIndex);
		// 91 to 300 days ago: before the book, and less than a year ago, so the ids stay unique.
		// The day is fixed in the calendar. It moves only once in 210 days, when it jumps to a newer day.
		const phase = randomInt(random, 0, OLD_VISIT_CYCLE_DAYS - 1);
		const fileAgeDays = daysBetween(patient.registeredAt, todayStart);
		let dayOffset = Math.max(
			-(BOOK_PAST_DAYS + 1) - ((todayEpochDay + phase) % OLD_VISIT_CYCLE_DAYS),
			// The file is 100 days old or more. The visit comes at least 9 days after it opened.
			-(fileAgeDays - 9),
		);
		let starts = slotStarts(practitioner, addDays(todayStart, dayOffset));
		// At most 6 steps back: every practitioner works on 2 days of the week or more.
		while (starts.length === 0) {
			dayOffset -= 1;
			starts = slotStarts(practitioner, addDays(todayStart, dayOffset));
		}
		const dayStart = addDays(todayStart, dayOffset);
		const startMinute = drawSome(random, starts, starts.length).find(
			(minute) => !takenSlots.has(`${dayOffset}:${practitioner.id}:${minute}`),
		);
		if (startMinute === undefined) {
			continue;
		}
		takenSlots.add(`${dayOffset}:${practitioner.id}:${startMinute}`);
		plans.push({
			...planVisit({
				random,
				patient,
				patientIndex,
				practitioner,
				startsAt: atMinute(dayStart, startMinute),
				isFirstVisit: false,
				isNoShow: false,
				roomFreeAt: 0,
				dayOffset,
				todayStart,
				id: nextId(dayStart),
			}),
			outcome: "completed",
			cancelAt: null,
		});
	}

	return plans.sort((first, second) => first.startsAt - second.startsAt);
}

// The status that the clock gives to one planned visit.
function statusAt(plan: AppointmentPlan, now: number): AppointmentStatus {
	if (plan.cancelAt !== null && plan.cancelAt <= now) {
		return "cancelled";
	}
	if (plan.outcome === "completed" && plan.arrivalAt <= now) {
		if (now < plan.consultStartAt) {
			return "checked_in";
		}
		return now < plan.consultEndAt ? "in_progress" : "completed";
	}
	if (
		plan.outcome === "no_show" &&
		now >= plan.startsAt + NO_SHOW_AFTER_MINUTES * MINUTE_MS
	) {
		return "no_show";
	}
	return plan.confirmAt !== null && plan.confirmAt <= now
		? "confirmed"
		: "scheduled";
}

// A step time, or null while the step is still in the future.
function pastOrNull(time: number | null, now: number): number | null {
	return time !== null && time <= now ? time : null;
}

function toAppointment(plan: AppointmentPlan, now: number): Appointment {
	const status = statusAt(plan, now);
	const didArrive =
		status === "checked_in" ||
		status === "in_progress" ||
		status === "completed";
	return {
		id: plan.id,
		patientId: plan.patientId,
		practitionerId: plan.practitionerId,
		startsAt: plan.startsAt,
		durationMinutes: plan.durationMinutes,
		visitType: plan.visitType,
		reason: plan.reason,
		room: plan.room,
		status,
		bookedAt: plan.bookedAt,
		confirmedAt: pastOrNull(plan.confirmAt, now),
		checkedInAt: didArrive ? plan.arrivalAt : null,
		startedAt: didArrive ? pastOrNull(plan.consultStartAt, now) : null,
		endedAt: status === "completed" ? plan.consultEndAt : null,
		cancelledAt: status === "cancelled" ? plan.cancelAt : null,
	};
}

// The plans of one day. The key is the local midnight of today, so the rows change only at midnight.
let cache: { todayStart: number; plans: AppointmentPlan[] } | null = null;

/** Every appointment of the book, oldest first, with the status at the time `now` (milliseconds since 1970). */
export function listAppointments(now: number): Appointment[] {
	const todayStart = startOfLocalDay(now);
	if (cache?.todayStart !== todayStart) {
		cache = { todayStart, plans: buildBook(todayStart) };
	}
	return cache.plans.map((plan) => toAppointment(plan, now));
}

/** True when the patient is expected and the start time passed: the front desk must call. */
export function isLate(appointment: Appointment, now: number): boolean {
	return isUpcomingStatus(appointment.status) && appointment.startsAt < now;
}

/**
 * True for the next patient candidates: a patient in the waiting room, or a booking that starts at `now` or later.
 * A late booking is not a candidate. isLate covers it.
 */
export function isComing(
	appointment: Pick<Appointment, "status" | "startsAt">,
	now: number,
): boolean {
	// A patient in the waiting room is still to see, also when the practitioner runs behind the start time.
	return (
		appointment.status === "checked_in" ||
		(isUpcomingStatus(appointment.status) && appointment.startsAt >= now)
	);
}
