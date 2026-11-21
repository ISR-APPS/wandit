// Formatters of the restaurant pages: money in cents, clock times, minutes, relative times, counts, and message fill.
// Every page imports them from ~/features/restaurant, so amounts and times look the same everywhere.
// They take the `locale` of useT(), so a second app language needs no change here.
import { RESTAURANT_CURRENCY } from "./sample-menu";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** A money formatter in the restaurant currency with cents, for example "€28.00". */
export function moneyFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: RESTAURANT_CURRENCY,
	});
}

/** A money formatter with no cents, for large totals in headers and charts, for example "€7,343". */
export function wholeMoneyFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: RESTAURANT_CURRENCY,
		maximumFractionDigits: 0,
	});
}

/** Cents to the currency text of `format`. The unit conversion lives here only. */
export function formatCents(format: Intl.NumberFormat, cents: number): string {
	return format.format(cents / 100);
}

/** The clock time of an ISO time, for example "21:42" or "9:42 PM", in the app locale. */
export function formatClock(iso: string, locale: string): string {
	return new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(
		new Date(iso),
	);
}

/** Whole minutes from an ISO time to `now` (milliseconds since 1970). Never below 0. */
export function minutesSince(iso: string, now: number): number {
	return Math.max(0, Math.floor((now - Date.parse(iso)) / MINUTE_MS));
}

/** A count of minutes as a short unit text: "42 min" under one hour, "2 hr 8 min" or "2 hr" from 60. */
export function formatMinutes(minutes: number, locale: string): string {
	const unit = (name: "hour" | "minute") =>
		new Intl.NumberFormat(locale, {
			style: "unit",
			unit: name,
			unitDisplay: "short",
		});
	if (minutes < 60) {
		return unit("minute").format(minutes);
	}
	const hours = unit("hour").format(Math.floor(minutes / 60));
	const rest = minutes % 60;
	return rest === 0 ? hours : `${hours} ${unit("minute").format(rest)}`;
}

// Midnight at the start of the local day of `ms`, in milliseconds since 1970.
function startOfLocalDay(ms: number): number {
	return new Date(ms).setHours(0, 0, 0, 0);
}

/**
 * `timestamp` (ISO) against `now` (milliseconds since 1970), as "12 minutes ago" or "in 20 minutes".
 * Days are calendar days in the browser time zone.
 */
export function formatRelativeTime(
	timestamp: string,
	now: number,
	locale: string,
): string {
	const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
	const differenceMs = Date.parse(timestamp) - now;
	// Under 45 minutes, minutes are exact. Just after midnight, "yesterday" would hide "20 minutes ago".
	if (Math.abs(differenceMs) < 45 * MINUTE_MS) {
		// Under 45 seconds reads "now".
		return Math.abs(differenceMs) < 45_000
			? format.format(0, "second")
			: format.format(Math.round(differenceMs / MINUTE_MS), "minute");
	}
	// Math.round absorbs the 23-hour and 25-hour days of a clock change.
	const days = Math.round(
		(startOfLocalDay(Date.parse(timestamp)) - startOfLocalDay(now)) / DAY_MS,
	);
	if (days !== 0 && Math.abs(differenceMs) >= 12 * HOUR_MS) {
		return format.format(days, "day");
	}
	return format.format(Math.round(differenceMs / HOUR_MS), "hour");
}

/** Puts values into a message, for example "{count} covers" with { count: "4" }. A missing value keeps its slot. */
export function fillMessage(
	template: string,
	values: Record<string, string>,
): string {
	return template.replace(/\{(\w+)\}/g, (slot, name: string) =>
		Object.hasOwn(values, name) ? (values[name] ?? slot) : slot,
	);
}

/**
 * A count with its noun, for example "1 cover" or "4 covers".
 * `one` and `other` are messages with a {count} slot, from the `counts` group. Intl.PluralRules picks one for the language.
 */
export function countLabel(
	count: number,
	one: string,
	other: string,
	locale: string,
): string {
	const isOne = new Intl.PluralRules(locale).select(count) === "one";
	return fillMessage(isOne ? one : other, {
		count: new Intl.NumberFormat(locale).format(count),
	});
}
