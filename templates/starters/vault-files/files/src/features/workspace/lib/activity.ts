// The activity feed of the workspace: uploads, new versions, shares, and moves to the trash, newest first.
// The Recent page lists it; the file page shows the entries of one file. Both read it through their queries.
// Each entry comes from a row that exists already, so the feed and the other pages always agree.
import type { ActivityAction, FileKind } from "./codes";
import type { Workspace } from "./workspace";

/** One entry of the feed. */
export type ActivityItem = {
	/** Stable key, made from the action and the source row. */
	id: string;
	action: ActivityAction;
	/** ISO time of the event. */
	at: string;
	actorName: string;
	fileId: string;
	fileName: string;
	fileKind: FileKind;
	/** Folder names of the file, from the top folder down. */
	path: string[];
	/** True when the file is in the trash now. The pages then link to the trash, not to the file page. */
	isInTrash: boolean;
	/** The version number of an upload. null for a share or a delete. */
	versionNumber: number | null;
	/** Who got a share: the contact names, or an empty list for a public link. */
	recipientNames: string[];
};

/** Every entry since `sinceMs` (milliseconds since 1970), newest first. */
export function buildActivity(
	workspace: Workspace,
	sinceMs: number,
): ActivityItem[] {
	const memberName = new Map(
		workspace.members.map((row) => [row.id, row.name]),
	);
	const files = new Map(
		[...workspace.files, ...workspace.trash].map((file) => [file.id, file]),
	);
	const trashIds = new Set(workspace.trash.map((file) => file.id));
	const isRecent = (iso: string) => Date.parse(iso) >= sinceMs;
	const items: ActivityItem[] = [];

	for (const upload of workspace.uploads) {
		const file = files.get(upload.fileId);
		if (!file || !isRecent(upload.at)) {
			continue;
		}
		items.push({
			id: `upload-${upload.fileId}-${upload.versionNumber}`,
			action: upload.versionNumber === 1 ? "uploaded" : "updated",
			at: upload.at,
			actorName: memberName.get(upload.uploaderId) ?? "",
			fileId: file.id,
			fileName: file.name,
			fileKind: file.kind,
			path: file.path,
			isInTrash: trashIds.has(file.id),
			versionNumber: upload.versionNumber,
			recipientNames: [],
		});
	}
	for (const share of workspace.shares) {
		if (!isRecent(share.createdAt)) {
			continue;
		}
		items.push({
			id: `share-${share.id}`,
			action: "shared",
			at: share.createdAt,
			actorName: share.sharedByName,
			fileId: share.fileId,
			fileName: share.fileName,
			fileKind: share.fileKind,
			path: share.path,
			isInTrash: trashIds.has(share.fileId),
			versionNumber: null,
			recipientNames: share.recipients.map((contact) => contact.name),
		});
	}
	for (const file of workspace.trash) {
		if (!isRecent(file.deletedAt)) {
			continue;
		}
		items.push({
			id: `delete-${file.id}`,
			action: "deleted",
			at: file.deletedAt,
			actorName: file.deletedByName,
			fileId: file.id,
			fileName: file.name,
			fileKind: file.kind,
			path: file.path,
			isInTrash: true,
			versionNumber: null,
			recipientNames: [],
		});
	}
	return items.sort(
		(first, second) => Date.parse(second.at) - Date.parse(first.at),
	);
}
