// Builds the data of the file page: the file, its versions newest first, its editors, its shares, its feed, its folder, and its totals.
// fileQueryOptions calls it on the workspace of now. It is pure, so a later SQL read can return the same shape.
import type {
	ActivityItem,
	FileItem,
	FolderRow,
	MemberRow,
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
	/** Bytes of all live files in the same folder, this file included. The page shows the share of this file. */
	folderBytes: number;
	/** Opens of the file through all its shares, expired ones too. */
	shareViews: number;
	/** Each team member who uploaded a version, once, by the newest upload first. */
	editors: MemberRow[];
};

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
	const memberById = new Map(workspace.members.map((row) => [row.id, row]));
	const uploads = workspace.uploads
		.filter((upload) => upload.fileId === fileId)
		.sort((first, second) => second.versionNumber - first.versionNumber);
	const editorIds = [...new Set(uploads.map((upload) => upload.uploaderId))];
	return {
		file,
		versions: uploads.map((upload) => ({
			number: upload.versionNumber,
			uploadedAt: upload.at,
			uploaderName: memberById.get(upload.uploaderId)?.name ?? "",
			sizeBytes: upload.sizeBytes,
		})),
		editors: editorIds.flatMap((id) => memberById.get(id) ?? []),
		shares: workspace.shares.filter((share) => share.fileId === fileId),
		activity: activity.filter((item) => item.fileId === fileId),
		folder: workspace.folders.find((row) => row.id === file.folderId) ?? null,
		folderBytes: workspace.files
			.filter((item) => item.folderId === file.folderId)
			.reduce((sum, item) => sum + item.sizeBytes, 0),
		shareViews: workspace.shares
			.filter((share) => share.fileId === fileId)
			.reduce((sum, share) => sum + share.views, 0),
	};
}
