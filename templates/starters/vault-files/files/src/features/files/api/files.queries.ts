// Reads of the file browser: every live file with the folder tree, and one file with its history.
// The Files routes and the home route prefetch them in their loaders. The pages read them with useSuspenseQuery.
// Each queryFn reads the sample workspace now. A later turn replaces each body with Supabase reads.
import { queryOptions } from "@tanstack/react-query";
import {
	buildActivity,
	type FileItem,
	type FolderRow,
	readWorkspace,
} from "~/features/workspace";
import { buildFileDetail } from "../lib/file-detail";

/** Every live file, newest change first, and every folder. The browser filters them in the page. */
type FilesList = {
	files: FileItem[];
	folders: FolderRow[];
	/** Bytes of the files in the trash. The top of the browser shows them, so its total agrees with the home. */
	trashBytes: number;
};

/** All live files and folders. The home shows the first rows; the Files page browses them. */
export function filesQueryOptions() {
	return queryOptions({
		queryKey: ["files", "list"],
		queryFn: async (): Promise<FilesList> => {
			const workspace = readWorkspace(Date.now());
			return {
				files: workspace.files,
				folders: workspace.folders,
				trashBytes: workspace.trash.reduce(
					(sum, file) => sum + file.sizeBytes,
					0,
				),
			};
		},
	});
}

/** One live file with its versions, shares, activity, and neighbors, or null for an unknown or trashed id. */
export function fileQueryOptions(fileId: string) {
	return queryOptions({
		queryKey: ["files", "detail", fileId],
		queryFn: async () => {
			const now = Date.now();
			const workspace = readWorkspace(now);
			// The feed of one file covers its whole life, so the start is the oldest possible time.
			return buildFileDetail(workspace, buildActivity(workspace, 0), fileId);
		},
	});
}
