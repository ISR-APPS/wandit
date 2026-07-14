import { PROJECT_TILE_GRADIENTS } from "@/features/projects/lib/constants";

export type ProjectTileGradient = (typeof PROJECT_TILE_GRADIENTS)[number];

export type ShortRelativeTimeLabels = {
	now: string;
	separator: string;
	minute: string;
	hour: string;
	day: string;
	week: string;
	month: string;
	year: string;
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;
const COMBINING_MARKS_PATTERN = /\p{M}/gu;
const ARABIC_TATWEEL_PATTERN = /\u0640/g;

export function getProjectTileGradient(seed: number): ProjectTileGradient {
	if (!Number.isFinite(seed)) {
		return PROJECT_TILE_GRADIENTS[0];
	}

	const index = Math.abs(Math.trunc(seed)) % PROJECT_TILE_GRADIENTS.length;
	return PROJECT_TILE_GRADIENTS[index] ?? PROJECT_TILE_GRADIENTS[0];
}

export function formatShortRelativeTime(
	value: Date | number | string,
	labels: ShortRelativeTimeLabels,
	now: Date | number | string = new Date(),
) {
	const timestamp = toTimestamp(value);
	const nowTimestamp = toTimestamp(now);

	if (timestamp === null || nowTimestamp === null) {
		return labels.now;
	}

	const elapsedMs = Math.max(0, nowTimestamp - timestamp);

	if (elapsedMs < MINUTE_MS) {
		return labels.now;
	}

	if (elapsedMs < HOUR_MS) {
		return formatRelativeCount(elapsedMs, MINUTE_MS, labels.minute, labels);
	}

	if (elapsedMs < DAY_MS) {
		return formatRelativeCount(elapsedMs, HOUR_MS, labels.hour, labels);
	}

	if (elapsedMs < WEEK_MS) {
		return formatRelativeCount(elapsedMs, DAY_MS, labels.day, labels);
	}

	if (elapsedMs < MONTH_MS) {
		return formatRelativeCount(elapsedMs, WEEK_MS, labels.week, labels);
	}

	if (elapsedMs < YEAR_MS) {
		return formatRelativeCount(elapsedMs, MONTH_MS, labels.month, labels);
	}

	return formatRelativeCount(elapsedMs, YEAR_MS, labels.year, labels);
}

export function foldProjectSearchText(value: string, locale?: string) {
	return value
		.normalize("NFD")
		.replace(COMBINING_MARKS_PATTERN, "")
		.replace(ARABIC_TATWEEL_PATTERN, "")
		.toLocaleLowerCase(locale);
}

function formatRelativeCount(
	elapsedMs: number,
	unitMs: number,
	unitLabel: string,
	labels: ShortRelativeTimeLabels,
) {
	const count = Math.max(1, Math.floor(elapsedMs / unitMs));
	return `${count}${labels.separator}${unitLabel}`;
}

function toTimestamp(value: Date | number | string) {
	const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
	return Number.isFinite(timestamp) ? timestamp : null;
}
