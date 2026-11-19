// The workspace at one moment: it moves the sample events of today before now and joins the names.
// The queryFn of every api file calls readWorkspace(now). A later turn replaces those queryFn bodies with Supabase reads.
// The rules of the derived fields live here: the current version, the share state, and the trash end date.
import {
	CATEGORY_OF_KIND,
	type FileCategory,
	type FileExtension,
	type FileKind,
	KIND_OF_EXTENSION,
	type ShareAccess,
	type ShareStatus,
	type Team,
} from "./codes";
import {
	buildSampleWorkspace,
	type ContactRow,
	type FolderRow,
	type MemberRow,
	type SampleWorkspace,
	WORKSPACE_PLAN,
} from "./sample-data";
import { addLocalDays, DAY_MS, startOfLocalDay } from "./time";

/** A share that ends within this many days is "expiring": the Shared page asks for a decision. */
export const EXPIRING_SOON_DAYS = 7;

/** A trashed file whose final delete comes within this many calendar days is "deleted soon": the bell and the Trash tab list it. */
export const PURGE_SOON_DAYS = 7;

/** One live file with its current version, its place, and the names of its people. */
export type FileItem = {
	id: string;
	name: string;
	extension: FileExtension;
	kind: FileKind;
	category: FileCategory;
	/** null for a file at the top of the workspace. */
	folderId: string | null;
	/** Folder names from the top folder down to the folder of the file. Empty at the top. */
	path: string[];
	ownerId: string;
	ownerName: string;
	/** Size of the current (last) version in bytes. Older versions do not count toward storage. */
	sizeBytes: number;
	/** ISO time of version 1. */
	createdAt: string;
	/** ISO time of the current version. */
	modifiedAt: string;
	modifiedByName: string;
	versionCount: number;
	/** Shares that still work now: active or expiring. */
	liveShareCount: number;
};

/** One file in the trash. Vault deletes it for good at `purgeAt`. */
export type TrashItem = FileItem & {
	/** ISO time of the move to the trash. */
	deletedAt: string;
	deletedByName: string;
	/** ISO time of the final delete: the delete time plus WORKSPACE_PLAN.trashRetentionDays. */
	purgeAt: string;
};

/** One share with the file, the people, and its state now. */
export type ShareItem = {
	id: string;
	fileId: string;
	fileName: string;
	fileKind: FileKind;
	/** Folder names of the file, as in FileItem. */
	path: string[];
	sharedByName: string;
	createdAt: string;
	mode: "link" | "people";
	access: ShareAccess;
	/** The invited contacts. Empty for a link. */
	recipients: ContactRow[];
	expiresAt: string | null;
	views: number;
	status: ShareStatus;
};

/** One upload of a version: the event of the uploads chart and of the Recent page. */
export type UploadEvent = {
	fileId: string;
	versionNumber: number;
	/** ISO time of the upload. */
	at: string;
	category: FileCategory;
	uploaderId: string;
	uploaderTeam: Team;
	sizeBytes: number;
};

/** The workspace as the pages see it at `now`. */
export type Workspace = {
	members: MemberRow[];
	folders: FolderRow[];
	files: FileItem[];
	trash: TrashItem[];
	shares: ShareItem[];
	uploads: UploadEvent[];
	plan: typeof WORKSPACE_PLAN;
};

// One build per local day. The rows of a day never change, so the pages agree while the clock moves.
let cached: { dayStartMs: number; rows: SampleWorkspace } | null = null;

function sampleRowsOf(now: number): SampleWorkspace {
	const dayStartMs = startOfLocalDay(now);
	if (cached?.dayStartMs !== dayStartMs) {
		cached = { dayStartMs, rows: buildSampleWorkspace(dayStartMs) };
	}
	return cached.rows;
}

/** The state of a share at `now`. A share with no end date stays active. */
export function readShareStatus(
	expiresAt: string | null,
	now: number,
): ShareStatus {
	if (expiresAt === null) {
		return "active";
	}
	const leftMs = Date.parse(expiresAt) - now;
	if (leftMs <= 0) {
		return "expired";
	}
	return leftMs <= EXPIRING_SOON_DAYS * DAY_MS ? "expiring" : "active";
}

/**
 * The workspace at `now` (milliseconds since 1970). The rows are the same all day.
 * Only the times of today's events change: they spread over the hours since midnight.
 */
export function readWorkspace(now: number): Workspace {
	const rows = sampleRowsOf(now);
	const todayStartMs = startOfLocalDay(now);
	// addLocalDays gives the true length of today, also on a 23-hour or 25-hour clock-change day.
	const todayLengthMs = addLocalDays(todayStartMs, 1) - todayStartMs;
	// A sample event of today keeps its place in the day, scaled to the time since midnight.
	// So no event is later than now, and the counts and totals stay the same while the clock moves.
	const atNow = (iso: string): string => {
		const atMs = Date.parse(iso);
		if (atMs < todayStartMs) {
			return iso;
		}
		const dayFraction = (atMs - todayStartMs) / todayLengthMs;
		return new Date(
			todayStartMs + dayFraction * (now - todayStartMs),
		).toISOString();
	};
	const memberById = new Map(rows.members.map((row) => [row.id, row]));
	const folderById = new Map(rows.folders.map((row) => [row.id, row]));
	const contactById = new Map(rows.contacts.map((row) => [row.id, row]));
	const nameOf = (memberId: string | null) =>
		(memberId === null ? undefined : memberById.get(memberId))?.name ?? "";
	const pathOf = (folderId: string | null): string[] => {
		const names: string[] = [];
		let folder = folderId === null ? undefined : folderById.get(folderId);
		while (folder) {
			names.unshift(folder.name);
			folder =
				folder.parentId === null ? undefined : folderById.get(folder.parentId);
		}
		return names;
	};

	const shares = rows.shares.map((share) => ({
		...share,
		createdAt: atNow(share.createdAt),
	}));
	const liveShareCounts = new Map<string, number>();
	for (const share of shares) {
		if (readShareStatus(share.expiresAt, now) !== "expired") {
			liveShareCounts.set(
				share.fileId,
				(liveShareCounts.get(share.fileId) ?? 0) + 1,
			);
		}
	}

	const files: FileItem[] = [];
	const trash: TrashItem[] = [];
	const uploads: UploadEvent[] = [];
	const visibleFileById = new Map<string, FileItem>();
	for (const row of rows.files) {
		const versions = row.versions.map((version) => ({
			...version,
			uploadedAt: atNow(version.uploadedAt),
		}));
		const first = versions[0];
		const current = versions[versions.length - 1];
		// buildSampleWorkspace keeps only files with a version, so this guard only narrows the type.
		if (!first || !current) {
			continue;
		}
		const kind = KIND_OF_EXTENSION[row.extension];
		const item: FileItem = {
			id: row.id,
			name: row.name,
			extension: row.extension,
			kind,
			category: CATEGORY_OF_KIND[kind],
			folderId: row.folderId,
			path: pathOf(row.folderId),
			ownerId: row.ownerId,
			ownerName: nameOf(row.ownerId),
			sizeBytes: current.sizeBytes,
			createdAt: first.uploadedAt,
			modifiedAt: current.uploadedAt,
			modifiedByName: nameOf(current.uploadedById),
			versionCount: versions.length,
			liveShareCount: liveShareCounts.get(row.id) ?? 0,
		};
		for (const version of versions) {
			const uploader = memberById.get(version.uploadedById);
			uploads.push({
				fileId: row.id,
				versionNumber: version.number,
				at: version.uploadedAt,
				category: item.category,
				uploaderId: version.uploadedById,
				uploaderTeam: uploader?.team ?? "operations",
				sizeBytes: version.sizeBytes,
			});
		}
		visibleFileById.set(row.id, item);
		if (row.deletedAt !== null) {
			const deletedAt = atNow(row.deletedAt);
			trash.push({
				...item,
				deletedAt,
				deletedByName: nameOf(row.deletedById),
				purgeAt: purgeTimeOf(deletedAt),
			});
		} else {
			files.push(item);
		}
	}

	return {
		members: rows.members,
		folders: rows.folders,
		files: files.sort(byNewest((file) => file.modifiedAt)),
		trash: trash.sort(byNewest((file) => file.deletedAt)),
		shares: shares
			.flatMap((share) => {
				const file = visibleFileById.get(share.fileId);
				return file
					? [
							{
								id: share.id,
								fileId: share.fileId,
								fileName: file.name,
								fileKind: file.kind,
								path: file.path,
								sharedByName: nameOf(share.sharedById),
								createdAt: share.createdAt,
								mode: share.mode,
								access: share.access,
								recipients: share.contactIds.flatMap((id) => {
									const contact = contactById.get(id);
									return contact ? [contact] : [];
								}),
								expiresAt: share.expiresAt,
								views: share.views,
								status: readShareStatus(share.expiresAt, now),
							} satisfies ShareItem,
						]
					: [];
			})
			.sort(byNewest((share) => share.createdAt)),
		uploads: uploads.sort(byNewest((upload) => upload.at)),
		plan: WORKSPACE_PLAN,
	};
}

// The trash keeps a file for the retention days, counted in calendar days from the delete.
function purgeTimeOf(deletedAt: string): string {
	const deletedAtMs = Date.parse(deletedAt);
	const timeOfDayMs = deletedAtMs - startOfLocalDay(deletedAtMs);
	return new Date(
		addLocalDays(deletedAtMs, WORKSPACE_PLAN.trashRetentionDays) + timeOfDayMs,
	).toISOString();
}

/** A sort function: the newest ISO time first. */
function byNewest<Item>(timeOf: (item: Item) => string) {
	return (first: Item, second: Item) =>
		Date.parse(timeOf(second)) - Date.parse(timeOf(first));
}
