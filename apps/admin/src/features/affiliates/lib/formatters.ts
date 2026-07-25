export function formatAffiliateCurrency(
	amountUsdMinor: number,
	locale = "en-US",
) {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: "USD",
		currencyDisplay: "narrowSymbol",
		maximumFractionDigits: amountUsdMinor % 100 === 0 ? 0 : 2,
	}).format(amountUsdMinor / 100);
}

export function formatAffiliateCompactCurrency(
	amountUsdMinor: number,
	locale = "en-US",
) {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: "USD",
		currencyDisplay: "narrowSymbol",
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(amountUsdMinor / 100);
}

export function formatAffiliateCompactNumber(value: number, locale = "en-US") {
	return new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(value);
}

export function formatAffiliateWholeNumber(value: number, locale = "en-US") {
	return new Intl.NumberFormat(locale, {
		maximumFractionDigits: 0,
	}).format(value);
}

export const formatAffiliateNumber = formatAffiliateWholeNumber;

export function formatAffiliatePercent(
	value: number,
	maximumFractionDigits = 1,
	locale = "en-US",
) {
	return new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits,
	}).format(value / 100);
}

export function formatAffiliateDate(
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

export function formatAffiliateDateTime(value: string | null) {
	return formatAffiliateDate(value, "en-US", {
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		month: "short",
	});
}

export function getAffiliateInitials(name: string) {
	return name
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part.charAt(0))
		.join("")
		.toUpperCase();
}

export function titleCaseAffiliateValue(value: string) {
	return value
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}
