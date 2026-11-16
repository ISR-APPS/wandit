// Shapes and math of the home: the uploads per day by category, the uploads by team, and the four figures.
// overview.queries.ts calls these pure functions on readWorkspace(now). The panels take the types.
// A later turn moves the same math into SQL read functions (STARTER.md).

import {
	addLocalDays,
	FILE_CATEGORIES,
	type FileCategory,
	localDayKey,
	TEAMS,
	type Team,
	type UploadEvent,
	type Workspace,
} from "~/features/workspace";
import type { TranslationKey } from "~/shared/i18n";

/** The period choices of the uploads chart, in days. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** The period of the first load. The team breakdown always uses it and names it in its title. */
export const DEFAULT_DAYS: PeriodDays = 30;

/** The figures compare this many days with the same count of days just before. */
export const FIGURE_DAYS = 7;

/** One day and one category of the stacked chart. Every day has a row for every category. */
export type CategoryPoint = {
	/** Local day as YYYY-MM-DD. */
	day: string;
	category: FileCategory;
	/** Uploads (new files and new versions) of that day and category. */
	value: number;
};

/** One part of a breakdown, before or after the page translates its label. */
export type BreakdownSlice<Label extends string = string> = {
	label: Label;
	value: number;
};

/** One figure of the home band. `whole` feeds the meter. */
export type KpiItem = {
	/** Stable id, also the React key and the key of WHOLE_WORDS. */
	id: "storage-used" | "uploads-week" | "shared-files" | "seats";
	/** Label, already translated. */
	label: string;
	value: number;
	/** bytes shows "138 GB"; count shows a plain number. */
	unit: "bytes" | "count";
	/** The whole of the value: a capacity, a count of all, or the previous period. */
	whole: number;
};

/** A figure before the page translates its label. */
export type OverviewKpi = Omit<KpiItem, "label"> & { labelKey: TranslationKey };

// The start of the local day `days - 1` days before today: the first day of a period that ends today.
function periodStartMs(days: number, now: number): number {
	return addLocalDays(now, -(days - 1));
}

/** Uploads per local day and category for the last `days` days, oldest first. A day with no upload gives 0. */
export function dailyUploadsByCategory(
	uploads: UploadEvent[],
	days: number,
	now: number,
): CategoryPoint[] {
	const startMs = periodStartMs(days, now);
	const counts = new Map<string, number>();
	for (const upload of uploads) {
		const atMs = Date.parse(upload.at);
		if (atMs >= startMs && atMs <= now) {
			const key = `${localDayKey(atMs)}|${upload.category}`;
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
	}
	return Array.from({ length: days }, (_, index) =>
		localDayKey(addLocalDays(startMs, index)),
	).flatMap((day) =>
		FILE_CATEGORIES.map((category) => ({
			day,
			category,
			value: counts.get(`${day}|${category}`) ?? 0,
		})),
	);
}

/** Uploads per team of the uploader in the last `days` days, the largest first. A team with no upload gives 0. */
export function uploadsByTeam(
	uploads: UploadEvent[],
	days: number,
	now: number,
): BreakdownSlice<Team>[] {
	const startMs = periodStartMs(days, now);
	const counts = new Map<Team, number>(TEAMS.map((team) => [team, 0]));
	for (const upload of uploads) {
		const atMs = Date.parse(upload.at);
		if (atMs >= startMs && atMs <= now) {
			counts.set(
				upload.uploaderTeam,
				(counts.get(upload.uploaderTeam) ?? 0) + 1,
			);
		}
	}
	return [...counts]
		.map(([label, value]) => ({ label, value }))
		.sort((first, second) => second.value - first.value);
}

/**
 * The four figures of the home, the most important first.
 * Storage counts the current version of each file, also in the trash, against the plan.
 * Uploads compare the last FIGURE_DAYS days (today included) with the FIGURE_DAYS days before.
 */
export function buildOverviewKpis(
	workspace: Workspace,
	now: number,
): OverviewKpi[] {
	const storageUsed = [...workspace.files, ...workspace.trash].reduce(
		(sum, file) => sum + file.sizeBytes,
		0,
	);
	const weekStartMs = periodStartMs(FIGURE_DAYS, now);
	const previousStartMs = addLocalDays(weekStartMs, -FIGURE_DAYS);
	let uploadsWeek = 0;
	let uploadsPrevious = 0;
	for (const upload of workspace.uploads) {
		const atMs = Date.parse(upload.at);
		if (atMs >= weekStartMs && atMs <= now) {
			uploadsWeek += 1;
		} else if (atMs >= previousStartMs && atMs < weekStartMs) {
			uploadsPrevious += 1;
		}
	}
	return [
		{
			id: "storage-used",
			labelKey: "metrics.storageUsed",
			value: storageUsed,
			unit: "bytes",
			whole: workspace.plan.storageBytes,
		},
		{
			id: "uploads-week",
			labelKey: "metrics.uploadsWeek",
			value: uploadsWeek,
			unit: "count",
			whole: uploadsPrevious,
		},
		{
			id: "shared-files",
			labelKey: "metrics.sharedFiles",
			value: workspace.files.filter((file) => file.liveShareCount > 0).length,
			unit: "count",
			whole: workspace.files.length,
		},
		{
			id: "seats",
			labelKey: "metrics.seats",
			value: workspace.members.length,
			unit: "count",
			whole: workspace.plan.seats,
		},
	];
}
