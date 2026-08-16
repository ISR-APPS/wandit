export type LeadDateFilter =
	| "all"
	| "today"
	| "last7Days"
	| "last30Days"
	| "pickDay";

export type LeadDateRange = {
	createdFrom?: string;
	createdTo?: string;
};

const ALGIERS_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
	day: "2-digit",
	month: "2-digit",
	timeZone: "Africa/Algiers",
	year: "numeric",
});

function formatAlgiersDate(date: Date): string {
	const parts = ALGIERS_DATE_FORMATTER.formatToParts(date);
	const year = parts.find((part) => part.type === "year")?.value;
	const month = parts.find((part) => part.type === "month")?.value;
	const day = parts.find((part) => part.type === "day")?.value;

	if (!(year && month && day)) {
		throw new Error("Could not format the current date in Africa/Algiers");
	}

	return `${year}-${month}-${day}`;
}

function subtractCalendarDays(date: string, days: number): string {
	const [year, month, day] = date.split("-").map(Number);
	const result = new Date(Date.UTC(year, month - 1, day - days));
	return result.toISOString().slice(0, 10);
}

/** Resolve the owner-facing date presets to inclusive Algiers calendar days. */
export function getLeadDateRange(
	filter: LeadDateFilter,
	pickedDay: string,
	now = new Date(),
): LeadDateRange {
	if (filter === "all") return {};
	if (filter === "pickDay") {
		return pickedDay ? { createdFrom: pickedDay, createdTo: pickedDay } : {};
	}

	const today = formatAlgiersDate(now);
	if (filter === "today") {
		return { createdFrom: today, createdTo: today };
	}

	return {
		createdFrom: subtractCalendarDays(today, filter === "last7Days" ? 6 : 29),
		createdTo: today,
	};
}
