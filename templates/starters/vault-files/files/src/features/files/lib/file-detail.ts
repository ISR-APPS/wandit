// Builds the data of the file page: the file, its versions newest first, its shares, its feed, and its folder.
// fileQueryOptions calls it on the workspace of now. It is pure, so a later SQL read can return the same shape.
import type {
	ActivityItem,
	FileItem,
	FolderRow,
	ShareItem,
	Workspace,
} from "~/features/workspace";

/** One version row of the history table. */
export type FileVersion = {
	number: number;
	/** ISO time of the upload. */
	uploadedAt: string;
	uploaderName: string;
	sizeBytes: number;
};

/** Everything that the file page shows. */
export type FileDetail = {
	file: FileItem;
	/** Newest first. The first row is the current version. */
	versions: FileVersion[];
	/** Every share of the file, newest first, with expired ones. */
	shares: ShareItem[];
	/** The feed entries of this file, newest first. */
	activity: ActivityItem[];
	/** The folder of the file, or null at the top of the workspace. */
	folder: FolderRow | null;
	/** Up to 5 other live files of the same folder, newest change first. */
	neighbors: FileItem[];
};

// The rail lists a few neighbors only. The folder page lists all of them.
const NEIGHBOR_COUNT = 5;

/** The detail of `fileId`, or null when no live file has this id (unknown, or in the trash). */
export function buildFileDetail(
	workspace: Workspace,
	activity: ActivityItem[],
	fileId: string,
): FileDetail | null {
	const file = workspace.files.find((item) => item.id === fileId);
	if (!file) {
		return null;
	}
	const memberName = new Map(
		workspace.members.map((row) => [row.id, row.name]),
	);
	return {
		file,
		versions: workspace.uploads
			.filter((upload) => upload.fileId === fileId)
			.map((upload) => ({
				number: upload.versionNumber,
				uploadedAt: upload.at,
				uploaderName: memberName.get(upload.uploaderId) ?? "",
				sizeBytes: upload.sizeBytes,
			}))
			.sort((first, second) => second.number - first.number),
		shares: workspace.shares.filter((share) => share.fileId === fileId),
		activity: activity.filter((item) => item.fileId === fileId),
		folder: workspace.folders.find((row) => row.id === file.folderId) ?? null,
		neighbors: workspace.files
			.filter((item) => item.folderId === file.folderId && item.id !== fileId)
			.slice(0, NEIGHBOR_COUNT),
	};
}
