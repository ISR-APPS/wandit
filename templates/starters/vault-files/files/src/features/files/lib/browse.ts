// The folder logic of the file browser: the folder trail, the rows of one folder, and a search in a folder tree.
// FilesPage calls browseFolder during render. It is pure: the same list and options give the same rows.
import type { FileCategory, FileItem, FolderRow } from "~/features/workspace";
import type { FileSortState } from "./files-search";

/** One sub-folder row with the totals of everything under it. */
export type FolderEntry = {
	id: string;
	type: "folder";
	folder: FolderRow;
	/** Files in the folder and in its sub-folders. */
	fileCount: number;
	/** Bytes of those files. */
	sizeBytes: number;
	/** ISO time of the newest change under the folder, or null for an empty folder. */
	modifiedAt: string | null;
};

/** One file row. */
export type FileEntry = { id: string; type: "file"; file: FileItem };

/** One row of the browser: a folder or a file. */
export type BrowseEntry = FolderEntry | FileEntry;

/** The options of one browse: the search text, the type filter, and the sort. */
export type BrowseOptions = {
	/** Search text, as typed. Empty for no search. */
	query: string;
	category: FileCategory | undefined;
	sort: FileSortState;
	locale: string;
};

/** The rows of one folder view. */
export type BrowseResult = {
	/** Folders first, then files. A search or a type filter lists files only. */
	entries: BrowseEntry[];
	/** True when a search or a type filter is on: the rows come from the whole folder tree. */
	isFiltered: boolean;
};

/** The folders from the top folder down to `folderId`. Empty for the top of the workspace or an unknown id. */
export function folderTrail(
	folders: FolderRow[],
	folderId: string | null,
): FolderRow[] {
	const byId = new Map(folders.map((folder) => [folder.id, folder]));
	const trail: FolderRow[] = [];
	let folder = folderId === null ? undefined : byId.get(folderId);
	while (folder) {
		trail.unshift(folder);
		folder = folder.parentId === null ? undefined : byId.get(folder.parentId);
	}
	return trail;
}

// True when `folderId` is `ancestorId` or lies under it. null is the top: every folder lies under it.
function isInside(
	folderId: string | null,
	ancestorId: string | null,
	byId: Map<string, FolderRow>,
): boolean {
	if (ancestorId === null) {
		return true;
	}
	let current = folderId;
	while (current !== null) {
		if (current === ancestorId) {
			return true;
		}
		current = byId.get(current)?.parentId ?? null;
	}
	return false;
}

// The order of two files for one sort. The direction flips the order; ties keep the newest change first.
function compareFiles(sort: FileSortState, collator: Intl.Collator) {
	const sign = sort.direction === "ascending" ? 1 : -1;
	return (first: FileItem, second: FileItem) => {
		const order =
			sort.by === "name"
				? collator.compare(first.name, second.name)
				: sort.by === "size"
					? first.sizeBytes - second.sizeBytes
					: Date.parse(first.modifiedAt) - Date.parse(second.modifiedAt);
		return (
			sign * order ||
			Date.parse(second.modifiedAt) - Date.parse(first.modifiedAt)
		);
	};
}

/**
 * The rows of folder `folderId` (null is the top). With no search and no filter: its sub-folders, then its files.
 * With a search or a type filter: the matching files of the folder and of every folder under it.
 */
export function browseFolder(
	files: FileItem[],
	folders: FolderRow[],
	folderId: string | null,
	options: BrowseOptions,
): BrowseResult {
	const byId = new Map(folders.map((folder) => [folder.id, folder]));
	// Numeric collation sorts "Interview 2" before "Interview 10".
	const collator = new Intl.Collator(options.locale, { numeric: true });
	const needle = options.query.trim().toLocaleLowerCase(options.locale);
	const isFiltered = needle !== "" || options.category !== undefined;

	if (isFiltered) {
		const matches = files.filter(
			(file) =>
				isInside(file.folderId, folderId, byId) &&
				(options.category === undefined ||
					file.category === options.category) &&
				(needle === "" ||
					file.name.toLocaleLowerCase(options.locale).includes(needle)),
		);
		return {
			entries: matches
				.sort(compareFiles(options.sort, collator))
				.map((file) => ({ id: file.id, type: "file", file })),
			isFiltered,
		};
	}

	const folderEntries: FolderEntry[] = folders
		.filter((folder) => folder.parentId === folderId)
		.sort((first, second) => collator.compare(first.name, second.name))
		.map((folder) => {
			const inside = files.filter((file) =>
				isInside(file.folderId, folder.id, byId),
			);
			return {
				id: folder.id,
				type: "folder",
				folder,
				fileCount: inside.length,
				sizeBytes: inside.reduce((sum, file) => sum + file.sizeBytes, 0),
				// The list query returns the newest change first, so the first file is the newest.
				modifiedAt: inside[0]?.modifiedAt ?? null,
			};
		});
	const fileEntries: FileEntry[] = files
		.filter((file) => file.folderId === folderId)
		.sort(compareFiles(options.sort, collator))
		.map((file) => ({ id: file.id, type: "file", file }));
	return { entries: [...folderEntries, ...fileEntries], isFiltered };
}
