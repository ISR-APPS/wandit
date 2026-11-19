// Billing dates and names of a membership: the past and next payment days, and the initials of a member.
// The members pages call these pure functions.
// They read no data; the callers pass the member and the local midnight of today.
import type { Member } from "./sample-members";
import { planOf } from "./sample-plans";

// Day 0 of the next month is the last day of this month.
function daysInMonth(year: number, month: number): number {
	return new Date(year, month + 1, 0).getDate();
}

// The billing day of `month` for a member who joined on `joinDay`. A join on the 31st bills on the 30th in April.
function billingDate(year: number, month: number, joinDay: number): number {
	return new Date(
		year,
		month,
		Math.min(joinDay, daysInMonth(year, month)),
	).getTime();
}

/**
 * The local midnight of the next payment, from today on. The join day itself is paid, so it never counts.
 * A monthly plan pays each month on the join day, an annual plan on the join anniversary.
 * A frozen member pays again on the first day back. A lapsed member pays nothing: null.
 */
export function nextPaymentOn(
	member: Member,
	todayStart: number,
): number | null {
	if (member.status === "lapsed") {
		return null;
	}
	if (member.status === "frozen") {
		return member.frozenUntil;
	}
	const joined = new Date(member.joinedAt);
	const today = new Date(todayStart);
	const isAnnual = planOf(member.planId).billing === "year";
	// Two steps always reach a date after today: two months, or two years.
	for (let step = 0; step <= 2; step += 1) {
		const candidate = isAnnual
			? billingDate(
					today.getFullYear() + step,
					joined.getMonth(),
					joined.getDate(),
				)
			: billingDate(
					today.getFullYear(),
					today.getMonth() + step,
					joined.getDate(),
				);
		if (candidate >= todayStart && candidate > member.joinedAt) {
			return candidate;
		}
	}
	return null;
}

/**
 * The past payment days of a member, newest first, at most `count`. The join day is the first one.
 * A monthly plan pays each month on the join day, an annual plan on the anniversary.
 * A day inside a freeze pays nothing. A lapsed member pays nothing from the end day on.
 */
export function pastPaymentDays(
	member: Member,
	todayStart: number,
	count: number,
): number[] {
	const joined = new Date(member.joinedAt);
	const isAnnual = planOf(member.planId).billing === "year";
	const days: number[] = [];
	for (let step = 0; ; step += 1) {
		const day = isAnnual
			? billingDate(
					joined.getFullYear() + step,
					joined.getMonth(),
					joined.getDate(),
				)
			: billingDate(
					joined.getFullYear(),
					joined.getMonth() + step,
					joined.getDate(),
				);
		// The loop stops before today, or at the end of the membership. A payment day of today is
		// the next payment of nextPaymentOn, except the join day: the member paid it at sign-up.
		const isPast =
			day < todayStart || (day === todayStart && day === member.joinedAt);
		if (!isPast || (member.endedAt !== null && day >= member.endedAt)) {
			break;
		}
		const isFrozen =
			member.frozenFrom !== null &&
			member.frozenUntil !== null &&
			day >= member.frozenFrom &&
			day < member.frozenUntil;
		if (!isFrozen) {
			days.push(day);
		}
	}
	return days.slice(-count).reverse();
}

/** The first letters of the first and the last word of a name, for an avatar: "Ava Lindqvist" gives "AL". */
export function initialsOf(fullName: string): string {
	const words = fullName.trim().split(/\s+/);
	const first = Array.from(words[0] ?? "")[0] ?? "";
	const last =
		words.length > 1 ? (Array.from(words.at(-1) ?? "")[0] ?? "") : "";
	return `${first}${last}`.toLocaleUpperCase();
}
