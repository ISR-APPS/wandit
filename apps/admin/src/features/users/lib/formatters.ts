export function formatWholeNumber(value: number, locale = "en-US") {
	return new Intl.NumberFormat(locale, {
		maximumFractionDigits: 0,
	}).format(value);
}

export function formatAdminDate(
	value: string | null,
	locale = "en-US",
	options: Intl.DateTimeFormatOptions = {
		day: "numeric",
		month: "short",
		year: "numeric",
	},
) {
	if (!value) {
		return "—";
	}

	return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}

export function formatAdminDateTime(value: string | null, locale = "en-US") {
	return formatAdminDate(value, locale, {
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		month: "short",
		year: "numeric",
	});
}
