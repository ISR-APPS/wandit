// Shapes and math of the home figures: the daily check-ins, the KPI items, and the change formula.
// front-desk.queries.ts calls the two build functions. The check-ins panel and the KPI meters take the types.
// The sample book holds 14 past days. An older day comes from a seeded series, so 90 days have a shape.
import {
	addDays,
	BOOK_PAST_DAYS,
	BOOKING_CHANNELS,
	type BookingChannel,
	createSeededRandom,
	DAY_MS,
	type Reservation,
	type Room,
	startOfLocalDay,
	toIsoDay,
} from "~/features/hotel";
import type { TranslationKey } from "~/shared/i18n";

/** The period choices of the check-ins panel, in days. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One day of a trend. `day` is YYYY-MM-DD in the browser time zone. `previous` is the same day one period earlier. */
export type DailyPoint = {
	day: string;
	current: number;
	previous: number;
};

/** One KPI figure of the home, before translation. The page turns `labelKey` into a label with t(). */
export type KpiItem = {
	/** Stable id, also the React key, for example "rooms-sold". */
	id: string;
	/** Message key of the label. */
	labelKey: TranslationKey;
	value: number;
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null hides the delta. */
	change: number | null;
	/** "down" for a figure where a fall is good news. */
	goodWhen: "up" | "down";
	/** The whole of the value: a count of all. The meter reads it. */
	target: number;
};

/** One part of the channel breakdown: a booking channel and its count of check-ins. */
export type ChannelSlice = {
	channel: BookingChannel;
	value: number;
};

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

// Check-ins per weekday of the seeded series, Sunday first. The hotel fills up on Thursday and Friday.
const WEEKDAY_CHECK_INS = [2.6, 2.9, 3.4, 4.1, 5.6, 6.4, 4.3] as const;

// The hotel grows: a day is 0.1 % quieter for each day of its age. So a period shows a rise against the one before.
// The oldest day that a period reads is 180 days old: the factor stays above 0.8.
const DAILY_GROWTH = 0.001;

/**
 * Check-ins of a day before the sample book. The date is the seed, so the noise of a day is the same on every load.
 * `todayStart` is the local midnight of today: it gives the age of the day for the growth.
 */
function seededCheckIns(dayStart: number, todayStart: number): number {
	const date = new Date(dayStart);
	// Math.round absorbs the 23-hour and 25-hour days of a clock change.
	const ageDays = Math.round((todayStart - dayStart) / DAY_MS);
	// A whole number per calendar day: the days since 1970 in local time.
	const dayNumber = Math.round(
		(dayStart - date.getTimezoneOffset() * 60_000) / DAY_MS,
	);
	const random = createSeededRandom(dayNumber);
	const base = WEEKDAY_CHECK_INS[date.getDay()] ?? 4;
	// Noise of 35% up or down around the weekday level.
	return Math.max(
		0,
		Math.round(base * (1 - ageDays * DAILY_GROWTH) * (0.65 + random() * 0.7)),
	);
}

/**
 * Guests who checked in per day for the last `days` days, oldest first, with the same days one period earlier.
 * Today counts the arrivals until `now` (milliseconds since 1970).
 */
export function buildDailyCheckIns(
	reservations: Reservation[],
	days: number,
	now: number,
): DailyPoint[] {
	const todayStart = startOfLocalDay(now);
	const bookStart = addDays(todayStart, -BOOK_PAST_DAYS);
	const arrivalsPerDay = new Map<string, number>();
	for (const reservation of reservations) {
		if (reservation.arrivedAt) {
			arrivalsPerDay.set(
				reservation.checkIn,
				(arrivalsPerDay.get(reservation.checkIn) ?? 0) + 1,
			);
		}
	}
	const countOf = (dayStart: number) =>
		dayStart < bookStart
			? seededCheckIns(dayStart, todayStart)
			: (arrivalsPerDay.get(toIsoDay(dayStart)) ?? 0);
	return Array.from({ length: days }, (_, index) => {
		const dayStart = addDays(todayStart, index - (days - 1));
		return {
			day: toIsoDay(dayStart),
			current: countOf(dayStart),
			previous: countOf(addDays(dayStart, -days)),
		};
	});
}

/** The 2 KPIs of the home, the most important first: the rooms sold tonight, and the check-ins done today. */
export function buildFrontDeskKpis(
	rooms: Room[],
	reservations: Reservation[],
	now: number,
): KpiItem[] {
	const todayStart = startOfLocalDay(now);
	const today = toIsoDay(todayStart);
	const yesterday = toIsoDay(addDays(todayStart, -1));
	const stays = reservations.filter(
		(reservation) =>
			reservation.status !== "cancelled" && reservation.status !== "no_show",
	);
	// `YYYY-MM-DD` texts compare in date order. A stay holds the night of day D when it starts on D or before and ends after D.
	const soldOn = (day: string) =>
		stays.filter((stay) => stay.checkIn <= day && stay.checkOut > day).length;
	const arrivalsToday = stays.filter((stay) => stay.checkIn === today);
	return [
		{
			id: "rooms-sold",
			labelKey: "kpi.roomsSold",
			value: soldOn(today),
			target: rooms.length,
			change: changeRatio(soldOn(today), soldOn(yesterday)),
			goodWhen: "up",
		},
		// The whole changes each day, so this count has no previous period.
		{
			id: "check-ins-done",
			labelKey: "kpi.checkInsDone",
			value: arrivalsToday.filter((stay) => stay.arrivedAt !== null).length,
			target: arrivalsToday.length,
			change: null,
			goodWhen: "up",
		},
	];
}

/**
 * Check-ins per booking channel for the days of the sample book until `now`, the largest channel first.
 * The older days of the trend come from a seeded series with no channel, so the breakdown has its own period.
 */
export function buildChannelBreakdown(
	reservations: Reservation[],
): ChannelSlice[] {
	return BOOKING_CHANNELS.map((channel) => ({
		channel,
		value: reservations.filter(
			(reservation) =>
				reservation.channel === channel && reservation.arrivedAt !== null,
		).length,
	})).sort((first, second) => second.value - first.value);
}
