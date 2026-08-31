const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
	timeStyle: "short",
});

const wholeNumberFormatter = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 0,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 2,
	maximumFractionDigits: 6,
});

export function formatConversationDateTime(value: string | null): string {
	return value ? dateTimeFormatter.format(new Date(value)) : "No activity";
}

export function formatConversationCount(value: number | null): string {
	return value === null ? "—" : wholeNumberFormatter.format(value);
}

export function formatConversationCost(value: number | null): string {
	return value === null ? "—" : usdFormatter.format(value);
}

export function formatUsdMicros(value: number | null): string {
	return value === null ? "—" : usdFormatter.format(value / 1_000_000);
}

export function titleCaseIdentifier(value: string): string {
	return value
		.replaceAll(/[_-]+/g, " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
