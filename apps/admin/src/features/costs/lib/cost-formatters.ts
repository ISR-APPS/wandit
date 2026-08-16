import { formatOverviewUsdMinor } from "@/features/overview/lib/formatters";

const costMonthFormatter = new Intl.DateTimeFormat("en-US", {
	month: "long",
	timeZone: "UTC",
	year: "numeric",
});

const costUpdatedAtFormatter = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
	month: "short",
	timeZone: "UTC",
	year: "numeric",
});

export function formatCostMonth(month: string) {
	return costMonthFormatter.format(new Date(`${month}-01T00:00:00.000Z`));
}

export function formatCostUpdatedAt(value: string) {
	return costUpdatedAtFormatter.format(new Date(value));
}

export function formatCostSource(source: string) {
	return source
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

export function formatCostMoney(cents: number) {
	return formatOverviewUsdMinor(cents);
}
