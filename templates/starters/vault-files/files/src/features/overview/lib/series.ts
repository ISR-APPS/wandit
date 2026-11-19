// Shapes and math of the home: storage per file type, the quick-access folders, the newest uploads, and the transfer bars.
// overview.queries.ts calls these pure functions on readWorkspace(now). The cards take the types.
// A later turn moves the same math into SQL read functions (STARTER.md).
import {
	addLocalDays,
	FILE_CATEGORIES,
	type FileCategory,
	type FileKind,
	type UploadEvent,
	type Workspace,
} from "~/features/workspace";

/** The groupings of the transfer chart: 14 days, 12 weeks of 7 days, or 6 calendar months. Each ends today. */
export const TRANSFER_PERIODS = ["days", "weeks", "months"] as const;

/** One grouping of the transfer chart. Its label is the message key `overview.transferPeriods.<period>`. */
export type TransferPeriod = (typeof TRANSFER_PERIODS)[number];

/** The grouping of the first load. */
export const DEFAULT_TRANSFER_PERIOD: TransferPeriod = "weeks";

// The bar count of each grouping. 12 weeks gives the 12 bars of the kit chart.
const BAR_COUNT = { days: 14, weeks: 12, months: 6 } satisfies Record<
	TransferPeriod,
	number
>;

/** Storage of the live files of one type. */
export type CategoryUsage = {
	category: FileCategory;
	/** Live files of this type. */
	fileCount: number;
	/** Bytes of their current versions. */
	bytes: number;
};

/** One top folder of the quick-access row. */
export type QuickFolder = {
	id: string;
	name: string;
	/** Live files in the folder and in its sub-folders. */
	fileCount: number;
	/** ISO time of the newest change under the folder. */
	modifiedAt: string;
};

/** One new file of the "Recently uploaded" card. */
export type RecentUpload = {
	id: string;
	name: string;
	kind: FileKind;
	/** Bytes of the current version. */
	sizeBytes: number;
	/** ISO time of version 1. */
	uploadedAt: string;
};

/** Everything the home shows, except the transfer bars. */
export type Overview = {
	/** One entry per FILE_CATEGORIES item, in that order, also at 0. */
	categories: CategoryUsage[];
	/** Bytes of the live files. The type cards show their share of it. */
	liveBytes: number;
	/** Bytes in use against the plan: live files and the trash. */
	usedBytes: number;
	/** Storage of the plan in bytes. */
	planBytes: number;
	/** The QUICK_FOLDER_COUNT top folders with the newest change, newest first. */
	folders: QuickFolder[];
	/** The RECENT_UPLOAD_COUNT newest files, newest first. */
	recentUploads: RecentUpload[];
};

/** One bar of the transfer chart. */
export type TransferBar = {
	/** Start of the bar in milliseconds since 1970: a local day, the first day of a week, or the first of a month. */
	startMs: number;
	/** Files uploaded for the first time in the bar. */
	newFiles: number;
	/** New versions of files that existed before. */
	newVersions: number;
};

// The kit row shows 3 folder cards beside the storage card, and 5 rows in the upload table.
const QUICK_FOLDER_COUNT = 3;
const RECENT_UPLOAD_COUNT = 5;

/** The home figures of `workspace`. Storage counts the current version of each file, also in the trash. */
export function buildOverview(workspace: Workspace): Overview {
	const categories = FILE_CATEGORIES.map((category) => {
		const files = workspace.files.filter((file) => file.category === category);
		return {
			category,
			fileCount: files.length,
			bytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
		};
	});
	const liveBytes = categories.reduce((sum, row) => sum + row.bytes, 0);
	const trashBytes = workspace.trash.reduce(
		(sum, file) => sum + file.sizeBytes,
		0,
	);

	// Each file counts toward the top folder of its path: walk up the parent links.
	const parentOf = new Map(
		workspace.folders.map((folder) => [folder.id, folder.parentId]),
	);
	const topOf = (folderId: string): string => {
		let current = folderId;
		let parent = parentOf.get(current) ?? null;
		while (parent !== null) {
			current = parent;
			parent = parentOf.get(current) ?? null;
		}
		return current;
	};
	const totals = new Map<string, { fileCount: number; modifiedAt: string }>();
	for (const file of workspace.files) {
		if (file.folderId === null) {
			continue;
		}
		const topId = topOf(file.folderId);
		const total = totals.get(topId) ?? { fileCount: 0, modifiedAt: "" };
		total.fileCount += 1;
		if (file.modifiedAt > total.modifiedAt) {
			total.modifiedAt = file.modifiedAt;
		}
		totals.set(topId, total);
	}
	const folders = workspace.folders
		.filter((folder) => folder.parentId === null)
		.flatMap((folder) => {
			const total = totals.get(folder.id);
			return total
				? [{ id: folder.id, name: folder.name, ...total } satisfies QuickFolder]
				: [];
		})
		.sort((first, second) => second.modifiedAt.localeCompare(first.modifiedAt))
		.slice(0, QUICK_FOLDER_COUNT);

	const recentUploads = [...workspace.files]
		.sort((first, second) => second.createdAt.localeCompare(first.createdAt))
		.slice(0, RECENT_UPLOAD_COUNT)
		.map((file) => ({
			id: file.id,
			name: file.name,
			kind: file.kind,
			sizeBytes: file.sizeBytes,
			uploadedAt: file.createdAt,
		}));

	return {
		categories,
		liveBytes,
		usedBytes: liveBytes + trashBytes,
		planBytes: workspace.plan.storageBytes,
		folders,
		recentUploads,
	};
}

// The start of each bar, oldest first. The last bar holds today.
function barStarts(period: TransferPeriod, now: number): number[] {
	const count = BAR_COUNT[period];
	if (period === "months") {
		const today = new Date(now);
		return Array.from({ length: count }, (_, index) =>
			new Date(
				today.getFullYear(),
				today.getMonth() - (count - 1 - index),
				1,
			).getTime(),
		);
	}
	// A week bar is the 7 days that end on its last day, so the last bar ends today.
	const step = period === "weeks" ? 7 : 1;
	return Array.from({ length: count }, (_, index) =>
		addLocalDays(now, -(step * (count - index) - 1)),
	);
}

/** Uploads per bar of `period`, oldest bar first. A bar with no upload gives 0 and 0. */
export function transferBars(
	uploads: UploadEvent[],
	period: TransferPeriod,
	now: number,
): TransferBar[] {
	const starts = barStarts(period, now);
	const bars = starts.map((startMs) => ({
		startMs,
		newFiles: 0,
		newVersions: 0,
	}));
	for (const upload of uploads) {
		const atMs = Date.parse(upload.at);
		if (atMs > now) {
			continue;
		}
		// The bar before the first start that is later than the upload holds it. An upload before the first bar is outside.
		const laterIndex = starts.findIndex((startMs) => startMs > atMs);
		const bar = bars[(laterIndex === -1 ? starts.length : laterIndex) - 1];
		if (!bar) {
			continue;
		}
		if (upload.versionNumber === 1) {
			bar.newFiles += 1;
		} else {
			bar.newVersions += 1;
		}
	}
	return bars;
}
