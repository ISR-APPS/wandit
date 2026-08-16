const affiliateDateFormatter = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	month: "short",
	year: "numeric",
});

const affiliateDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	month: "short",
	year: "numeric",
	hour: "numeric",
	minute: "2-digit",
});

export function formatAffiliateMoney(
	cents: number,
	currency: string,
	compact = false,
) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: currency.toUpperCase(),
		currencyDisplay: "narrowSymbol",
		notation: compact ? "compact" : "standard",
		maximumFractionDigits: compact ? 1 : cents % 100 === 0 ? 0 : 2,
	}).format(cents / 100);
}

export function formatNullableAffiliateMoney(
	cents: number | null,
	currency: string,
	compact = false,
) {
	return cents === null ? "—" : formatAffiliateMoney(cents, currency, compact);
}

export function formatAffiliateNumber(value: number, compact = false) {
	return new Intl.NumberFormat("en-US", {
		notation: compact ? "compact" : "standard",
		maximumFractionDigits: compact ? 1 : 0,
	}).format(value);
}

export function formatAffiliateDate(value: string | null) {
	if (!value) {
		return "—";
	}
	return affiliateDateFormatter.format(new Date(value));
}

export function formatAffiliateDateTime(value: string | null) {
	if (!value) {
		return "—";
	}
	return affiliateDateTimeFormatter.format(new Date(value));
}

export function formatAffiliateRateBps(value: number | null) {
	if (value === null) {
		return "—";
	}
	return `${new Intl.NumberFormat("en-US", {
		maximumFractionDigits: value % 100 === 0 ? 0 : 2,
	}).format(value / 100)}%`;
}

export function titleCaseAffiliateValue(value: string) {
	return value
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}
