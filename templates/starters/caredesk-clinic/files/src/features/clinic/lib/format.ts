// Text helpers that every page of the practice uses: message templates, initials, and ages.
// The page components call them with the messages of useT(). They read no data.

/**
 * Puts values into a message, for example "{seen} of {total} seen". The values are numbers that Intl formatted.
 * The app-dashboard skill puts a number beside its words. A sentence with two numbers needs them inside, so it uses this.
 * A message never makes the noun agree with a number ("Visits: {count}"), so it needs no plural rule.
 * A name in braces with no value stays as it is, so a wrong template shows on the page.
 */
export function fillMessage(
	template: string,
	values: Record<string, string | number>,
): string {
	return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
		name in values ? String(values[name]) : placeholder,
	);
}

/** The first letters of the first and the last word of a name, for an avatar: "Maya Lindqvist" gives "ML". */
export function initialsOf(fullName: string): string {
	// A title is not part of the initials: "Dr. Amara Okafor" gives "AO".
	const words = fullName
		.trim()
		.split(/\s+/)
		.filter((word) => !word.endsWith("."));
	const first = Array.from(words[0] ?? "")[0] ?? "";
	const last =
		words.length > 1 ? (Array.from(words.at(-1) ?? "")[0] ?? "") : "";
	return `${first}${last}`.toLocaleUpperCase();
}

/** Full years from the `YYYY-MM-DD` day `dateOfBirth` to the time `now` (milliseconds since 1970). */
export function ageInYears(dateOfBirth: string, now: number): number {
	const [year = 0, month = 1, day = 1] = dateOfBirth.split("-").map(Number);
	const today = new Date(now);
	const hadBirthday =
		today.getMonth() + 1 > month ||
		(today.getMonth() + 1 === month && today.getDate() >= day);
	return today.getFullYear() - year - (hadBirthday ? 0 : 1);
}

/** A `YYYY-MM-DD` day as a Date at local midnight, for an Intl.DateTimeFormat. */
export function dayToDate(day: string): Date {
	// A date-time text with no offset is local time in JavaScript.
	return new Date(`${day}T00:00:00`);
}
