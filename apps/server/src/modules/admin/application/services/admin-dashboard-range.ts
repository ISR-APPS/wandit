import type { AdminOverviewQuery, AdminOverviewRange } from "@wandit/contracts";

const MILLISECONDS_PER_DAY = 86_400_000;

type AdminDashboardPresetRange = Exclude<AdminOverviewRange, "custom">;

const PRESET_DAYS: Readonly<Record<AdminDashboardPresetRange, number>> = {
	"7d": 7,
	"30d": 30,
	"90d": 90,
	"180d": 180,
	"365d": 365,
};

const PRESET_LABELS: Readonly<Record<AdminDashboardPresetRange, string>> = {
	"7d": "Last 7 days",
	"30d": "Last 30 days",
	"90d": "Last 90 days",
	"180d": "Last 6 months",
	"365d": "Last year",
};

export type AdminDashboardRangeBounds = {
	rangeStart: Date;
	rangeEnd: Date;
	seriesEnd: Date;
	snapshotEnd: Date;
};

export type ResolvedAdminDashboardRange = {
	bounds: AdminDashboardRangeBounds;
	rangeLabel: string;
};

export function resolveAdminDashboardRange(
	query: AdminOverviewQuery,
	generatedAt: Date,
): ResolvedAdminDashboardRange {
	const snapshotEnd = new Date(generatedAt);
	const todayStart = utcDateStart(snapshotEnd);

	if (query.range !== "custom") {
		return {
			bounds: {
				rangeStart: addUtcDays(todayStart, -(PRESET_DAYS[query.range] - 1)),
				rangeEnd: new Date(snapshotEnd),
				seriesEnd: todayStart,
				snapshotEnd,
			},
			rangeLabel: PRESET_LABELS[query.range],
		};
	}

	if (!query.from || !query.to) {
		throw new Error("Validated custom dashboard ranges require from and to");
	}

	const rangeStart = parseUtcDate(query.from);
	const selectedEnd = parseUtcDate(query.to);
	const selectedEndExclusive = addUtcDays(selectedEnd, 1);
	const rangeEnd =
		query.to === utcDate(snapshotEnd)
			? new Date(snapshotEnd)
			: selectedEndExclusive;

	return {
		bounds: {
			rangeStart,
			rangeEnd,
			seriesEnd: selectedEnd,
			snapshotEnd,
		},
		rangeLabel: formatCustomRangeLabel(rangeStart, selectedEnd),
	};
}

function utcDateStart(value: Date): Date {
	return new Date(
		Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
	);
}

function parseUtcDate(value: string): Date {
	return new Date(`${value}T00:00:00.000Z`);
}

function addUtcDays(value: Date, days: number): Date {
	return new Date(value.getTime() + days * MILLISECONDS_PER_DAY);
}

function utcDate(value: Date): string {
	return value.toISOString().slice(0, 10);
}

function formatCustomRangeLabel(from: Date, to: Date): string {
	const formatter = new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
		year: "numeric",
	});

	if (from.getTime() === to.getTime()) return formatter.format(from);

	return `${formatter.format(from)} – ${formatter.format(to)}`;
}
