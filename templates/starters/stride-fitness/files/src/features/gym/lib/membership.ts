// Billing dates and names of a membership: the next payment day and the initials of a member.
// The members pages and the renewals panel of the plans page call these pure functions.
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

/** The first letters of the first and the last word of a name, for an avatar: "Ava Lindqvist" gives "AL". */
export function initialsOf(fullName: string): string {
	const words = fullName.trim().split(/\s+/);
	const first = Array.from(words[0] ?? "")[0] ?? "";
	const last =
		words.length > 1 ? (Array.from(words.at(-1) ?? "")[0] ?? "") : "";
	return `${first}${last}`.toLocaleUpperCase();
}
