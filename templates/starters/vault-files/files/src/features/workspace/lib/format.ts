// Number formats of Vault: file sizes in decimal units, and member initials.
// The overview figures, the file tables, the grid cards, and the detail pages call them.

/** Decimal byte units, smallest first. Storage plans count 1 GB as 1,000,000,000 bytes. */
const BYTE_UNITS = [
	"byte",
	"kilobyte",
	"megabyte",
	"gigabyte",
	"terabyte",
] as const;

// One step of BYTE_UNITS is 1,000 bytes, the decimal unit of storage plans.
const BYTES_PER_STEP = 1000;

/** `bytes` as "2.4 MB" or "184 GB" in the app language. One decimal under 10 units, none above. */
export function formatBytes(bytes: number, locale: string): string {
	let value = Math.max(bytes, 0);
	let step = 0;
	while (value >= BYTES_PER_STEP && step < BYTE_UNITS.length - 1) {
		value /= BYTES_PER_STEP;
		step += 1;
	}
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: BYTE_UNITS[step],
		unitDisplay: "short",
		maximumFractionDigits: value < 10 && step > 0 ? 1 : 0,
	}).format(value);
}

/** The first letter of the first and the last word of a name: "Amara Lindqvist" gives "AL". */
export function initialsOf(name: string): string {
	const words = name.trim().split(/\s+/);
	const first = words[0]?.[0] ?? "";
	const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
	return `${first}${last}`.toLocaleUpperCase();
}

/** "one" or "other": the plural form of `count`. Messages with a count have one key per form. */
export function pluralForm(count: number, locale: string): "one" | "other" {
	return new Intl.PluralRules(locale).select(count) === "one" ? "one" : "other";
}

/** A message with a "{count}" slot, filled with `count` in the number format of the app language. */
export function fillCount(
	message: string,
	count: number,
	locale: string,
): string {
	return message.replace(
		"{count}",
		new Intl.NumberFormat(locale).format(count),
	);
}
