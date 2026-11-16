// Reads of the Trash page: the files in the trash, and the storage they hold against all used storage.
// The /app/trash route prefetches it in its loader. TrashPage reads it with useSuspenseQuery.
// The queryFn reads the sample workspace now. A later turn replaces its body with one Supabase select.
import { queryOptions } from "@tanstack/react-query";
import { readWorkspace } from "~/features/workspace";

/** The trash, the final delete first, with the bytes of the trash and of all storage in use. */
export function trashQueryOptions() {
	return queryOptions({
		queryKey: ["trash", "list"],
		queryFn: async () => {
			const workspace = readWorkspace(Date.now());
			const trashBytes = workspace.trash.reduce(
				(sum, file) => sum + file.sizeBytes,
				0,
			);
			return {
				files: [...workspace.trash].sort(
					(first, second) =>
						Date.parse(first.purgeAt) - Date.parse(second.purgeAt),
				),
				trashBytes,
				usedBytes: workspace.files.reduce(
					(sum, file) => sum + file.sizeBytes,
					trashBytes,
				),
				retentionDays: workspace.plan.trashRetentionDays,
			};
		},
	});
}
