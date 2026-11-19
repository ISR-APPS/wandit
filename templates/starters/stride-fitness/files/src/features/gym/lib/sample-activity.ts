// The dated class sessions, their bookings, and the check-ins at the front desk.
// This module stands in for the `class_sessions`, `bookings`, and `check_ins` tables.
// It turns TIMETABLE into sessions from 26 weeks ago to 6 days ahead, and books the members of sample-members.ts.
// The rows depend only on the local midnight of today, so they stay the same during one day.
import { addDays, atMinute, MINUTE_MS, toDayKey } from "./gym-time";
import {
	type ClassTypeId,
	classTypeOf,
	TIMETABLE,
	type TimetableSlot,
} from "./sample-classes";
import { isTrainingOn, type Member, membersOfDay } from "./sample-members";
import { planOf } from "./sample-plans";
import {
	createSeededRandom,
	pickWeightedIndexes,
	type Random,
	randomInt,
} from "./seeded-random";

/** One dated class of the timetable. */
export type ClassSession = {
	/** `YYYY-MM-DD-HHMM` of the start. Stable for the day, and the `session` search param of the classes page. */
	id: string;
	classTypeId: ClassTypeId;
	/** Start and end, in milliseconds since 1970. */
	startsAt: number;
	endsAt: number;
	/** Spots of the session. */
	capacity: number;
	/** The gym cancelled it. A cancelled session has no booking. */
	isCancelled: boolean;
	/** Ids of the members with a spot, in booking order. Never more than `capacity`. */
	bookedMemberIds: readonly string[];
	/** Members who wait for a spot. Only sessions of today and later keep a waitlist. */
	waitlistCount: number;
};

/** One entry at the front desk. */
export type CheckIn = {
	id: string;
	memberId: string;
	/** Time of the scan, in milliseconds since 1970. */
	at: number;
	/** The booked session of the visit, or null for open gym. */
	sessionId: string | null;
};

/** Every session and every check-in of the sample, oldest first. */
export type GymActivity = {
	sessions: readonly ClassSession[];
	/** Includes the check-ins of later today. Read them with `checkInsUntil`, never directly. */
	checkIns: readonly CheckIn[];
};

/** 26 weeks of history. The 90-day trend also compares with the 90 days before. */
export const HISTORY_DAYS = 182;
/** The timetable shows today and the next 6 days. */
export const AHEAD_DAYS = 6;

// Fixed seed: the same bookings on every load.
const ACTIVITY_SEED = 4242;
// 7 % of booked members do not come.
const SHOW_RATE = 0.93;
// About 1 % of sessions are cancelled: a coach is ill, a room needs repair.
const CANCEL_RATE = 0.012;
// A member with 3 visits a week also comes to open gym about one day in ten.
const OPEN_GYM_RATE_PER_VISIT = 0.035;
// A favorite class type is three times as likely as another one.
const FAVORITE_WEIGHT = 3;
// Share of the final bookings that exist N days before a session. Members book late.
const BOOKED_SHARE_AHEAD = [1, 0.85, 0.7, 0.58, 0.48, 0.4, 0.34] as const;
// A member books one class more than usual in about half of the weeks.
const EXTRA_CLASS_SHARE = 0.5;
// Seed of the weekly draw of the extra class. Apart from ACTIVITY_SEED, so the draw does not move the bookings.
const EXTRA_CLASS_SEED = 9001;
// Members arrive 3 to 16 minutes before a class starts.
const EARLIEST_ARRIVAL_MIN = 16;
const LATEST_ARRIVAL_MIN = 3;

// Demand by time of day: the early and evening slots fill, the midday slots do not.
function slotFactor(slot: TimetableSlot): number {
	const isWeekend = slot.weekday === 0 || slot.weekday === 6;
	if (isWeekend) {
		// 13:00 = minute 780.
		return slot.startMinute < 780 ? 1.05 : 0.72;
	}
	// 08:00 = minute 480, 16:00 = minute 960, 19:00 = minute 1140.
	if (slot.startMinute < 480) {
		return 1;
	}
	if (slot.startMinute < 960) {
		return 0.6;
	}
	return slot.startMinute < 1140 ? 1.1 : 0.88;
}

// An off-peak plan books weekday classes from 10:00 to 16:00 (minute 600 to 960), and every weekend class.
function canBook(member: Member, slot: TimetableSlot): boolean {
	if (planOf(member.planId).access === "all") {
		return true;
	}
	const isWeekend = slot.weekday === 0 || slot.weekday === 6;
	return isWeekend || (slot.startMinute >= 600 && slot.startMinute < 960);
}

// The open gym time of one visit, in minutes after midnight. Off-peak plans come from 10:00 to 15:59.
function openGymMinute(
	member: Member,
	weekday: number,
	random: Random,
): number {
	if (planOf(member.planId).access === "off-peak") {
		return randomInt(random, 600, 959);
	}
	const isWeekend = weekday === 0 || weekday === 6;
	// Weekends 08:00 to 17:59, weekdays 06:00 to 20:59.
	return isWeekend
		? randomInt(random, 480, 1079)
		: randomInt(random, 360, 1259);
}

// The classes that one member booked lately: the day offsets of the last 7 days, and the count of this month.
type BookingTally = {
	recentOffsets: number[];
	monthKey: string;
	monthCount: number;
};

// Whether the member may book one class more than usual in the week `weekIndex` (day offset / 7, rounded down).
// A seeded draw per member and week, so two weeks book different totals.
function hasExtraClass(member: Member, weekIndex: number): boolean {
	// The id is "m-" and a number. 1000 keeps the seeds of two members apart for 26 weeks of history.
	const memberNumber = Number.parseInt(member.id.slice(2), 10);
	const draw = createSeededRandom(
		EXTRA_CLASS_SEED + memberNumber * 1000 + weekIndex,
	)();
	return draw < EXTRA_CLASS_SHARE;
}

// In 7 days a member books the usual weekly visits, plus one class in some weeks. A plan with a monthly limit stops there.
function hasClassLeft(
	member: Member,
	tally: BookingTally | undefined,
	offset: number,
	monthKey: string,
): boolean {
	if (!tally) {
		return true;
	}
	const thisWeek = tally.recentOffsets.filter((day) => day > offset - 7).length;
	const weeklyCap =
		member.weeklyVisits +
		(hasExtraClass(member, Math.floor(offset / 7)) ? 1 : 0);
	if (thisWeek >= weeklyCap) {
		return false;
	}
	const limit = planOf(member.planId).classesPerMonth;
	const thisMonth = tally.monthKey === monthKey ? tally.monthCount : 0;
	return limit === null || thisMonth < limit;
}

// Adds one booking on day `offset` to the tally of a member.
function addBooking(
	tally: BookingTally | undefined,
	offset: number,
	monthKey: string,
): BookingTally {
	const isSameMonth = tally?.monthKey === monthKey;
	return {
		recentOffsets: [
			...(tally?.recentOffsets.filter((day) => day > offset - 7) ?? []),
			offset,
		],
		monthKey,
		monthCount: (isSameMonth ? tally.monthCount : 0) + 1,
	};
}

function buildActivity(todayStart: number): GymActivity {
	const random = createSeededRandom(ACTIVITY_SEED);
	const members = membersOfDay(todayStart);
	const sessions: ClassSession[] = [];
	const checkIns: CheckIn[] = [];
	const tallyOf = new Map<string, BookingTally>();

	for (let offset = -HISTORY_DAYS; offset <= AHEAD_DAYS; offset += 1) {
		const dayStart = addDays(todayStart, offset);
		const weekday = new Date(dayStart).getDay();
		const dayKey = toDayKey(dayStart);
		// "YYYY-MM" of the day: the month of a monthly class limit.
		const monthKey = dayKey.slice(0, 7);
		// A drifting member still pays, but books and scans nothing from `stopsComingFrom` on.
		const training = members.filter(
			(member) =>
				isTrainingOn(member, dayStart) &&
				(member.stopsComingFrom === null || dayStart < member.stopsComingFrom),
		);
		// One class per member and day.
		const bookedToday = new Set<string>();
		// The gym grows: demand rises from 82 % half a year ago to 100 % today.
		const growth = offset >= 0 ? 1 : 0.82 + 0.18 * (1 + offset / HISTORY_DAYS);
		const bookedShare = offset > 0 ? (BOOKED_SHARE_AHEAD[offset] ?? 0.3) : 1;

		for (const slot of TIMETABLE.filter((row) => row.weekday === weekday)) {
			const classType = classTypeOf(slot.classTypeId);
			const startsAt = atMinute(dayStart, slot.startMinute);
			const hours = String(Math.floor(slot.startMinute / 60)).padStart(2, "0");
			const minutes = String(slot.startMinute % 60).padStart(2, "0");
			const id = `${dayKey}-${hours}${minutes}`;
			const isCancelled = random() < CANCEL_RATE;
			// Noise of plus or minus 18 % keeps two Mondays from looking the same.
			const demand = Math.round(
				classType.capacity *
					classType.popularity *
					slotFactor(slot) *
					growth *
					bookedShare *
					(0.82 + random() * 0.36),
			);
			const candidates = training.filter(
				(member) =>
					!bookedToday.has(member.id) &&
					canBook(member, slot) &&
					hasClassLeft(member, tallyOf.get(member.id), offset, monthKey),
			);
			const weights = candidates.map(
				(member) =>
					member.weeklyVisits *
					(member.favoriteClassIds.includes(slot.classTypeId)
						? FAVORITE_WEIGHT
						: 1),
			);
			const picked = isCancelled
				? []
				: pickWeightedIndexes(
						random,
						weights,
						Math.min(demand, classType.capacity),
					);
			const booked = picked.flatMap((index) => {
				const member = candidates[index];
				return member ? [member] : [];
			});
			for (const member of booked) {
				bookedToday.add(member.id);
				tallyOf.set(
					member.id,
					addBooking(tallyOf.get(member.id), offset, monthKey),
				);
			}
			sessions.push({
				id,
				classTypeId: slot.classTypeId,
				startsAt,
				endsAt: startsAt + classType.minutes * MINUTE_MS,
				capacity: classType.capacity,
				isCancelled,
				bookedMemberIds: booked.map((member) => member.id),
				waitlistCount:
					offset >= 0 && !isCancelled
						? Math.max(0, demand - classType.capacity)
						: 0,
			});
			// Check-ins exist up to the end of today. checkInsUntil hides the ones after now.
			if (offset <= 0) {
				for (const member of booked) {
					if (random() < SHOW_RATE) {
						checkIns.push({
							id: `${id}-${member.id}`,
							memberId: member.id,
							at:
								startsAt -
								randomInt(random, LATEST_ARRIVAL_MIN, EARLIEST_ARRIVAL_MIN) *
									MINUTE_MS,
							sessionId: id,
						});
					}
				}
			}
		}

		if (offset <= 0) {
			for (const member of training) {
				if (
					!bookedToday.has(member.id) &&
					random() < OPEN_GYM_RATE_PER_VISIT * member.weeklyVisits
				) {
					checkIns.push({
						id: `${dayKey}-open-${member.id}`,
						memberId: member.id,
						at: atMinute(dayStart, openGymMinute(member, weekday, random)),
						sessionId: null,
					});
				}
			}
		}
	}
	checkIns.sort((first, second) => first.at - second.at);
	return { sessions, checkIns };
}

// The activity of one day. A cache, because the home, the lists, and the detail pages all read it.
let cache: { todayStart: number; activity: GymActivity } | null = null;

/** Sessions and check-ins built from the local midnight `todayStart`. The rows are the same during the whole day. */
export function activityOfDay(todayStart: number): GymActivity {
	if (cache?.todayStart !== todayStart) {
		cache = { todayStart, activity: buildActivity(todayStart) };
	}
	return cache.activity;
}

/** The check-ins up to `now`. A check-in of later today does not exist yet, so no page shows it. */
export function checkInsUntil(activity: GymActivity, now: number): CheckIn[] {
	return activity.checkIns.filter((checkIn) => checkIn.at <= now);
}
