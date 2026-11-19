// Reads of the header alerts: the shares that end soon and the trashed files that Vault deletes soon, the closest first.
// HeaderNotifications reads it after the shell renders. The rules are readShareStatus and PURGE_SOON_DAYS of lib/workspace.ts,
// so the bell counts the same rows as the "Ends soon" tab of Shared and the "Deleted soon" tab of Trash.
// The queryFn reads the sample workspace. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { calendarDaysFromNow } from "../lib/time";
import { PURGE_SOON_DAYS, readWorkspace } from "../lib/workspace";

// A share alert opens the page of its file. linkOptions types the path, so a wrong path fails typecheck.
function fileLink(fileId: string) {
	return linkOptions({ to: "/app/files/$fileId", params: { fileId } });
}

// A trashed file has no file page, so its alert opens the Trash page.
const TRASH_LINK = linkOptions({ to: "/app/trash" });

/** One alert of the bell menu. */
export type Alert = {
	/** Id of the share or of the trashed file. */
	id: string;
	/** "shareEnding": a share ends within 7 days. "purgeSoon": a trashed file is deleted for good within 7 days. */
	kind: "shareEnding" | "purgeSoon";
	/** The file name. */
	title: string;
	/** The folder path of the file, "Brand / Logos", or empty at the top. */
	detail: string;
	/** ISO time: the end of the share, or the final delete of the file. */
	at: string;
	link: ReturnType<typeof fileLink> | typeof TRASH_LINK;
};

/** Every alert, the closest time first. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const now = Date.now();
			const workspace = readWorkspace(now);
			const endingShares: Alert[] = workspace.shares.flatMap((share) =>
				share.status === "expiring" && share.expiresAt !== null
					? [
							{
								id: share.id,
								kind: "shareEnding",
								title: share.fileName,
								detail: share.path.join(" / "),
								at: share.expiresAt,
								link: fileLink(share.fileId),
							},
						]
					: [],
			);
			const purgeSoon: Alert[] = workspace.trash
				.filter(
					(file) => calendarDaysFromNow(file.purgeAt, now) <= PURGE_SOON_DAYS,
				)
				.map((file) => ({
					id: file.id,
					kind: "purgeSoon",
					title: file.name,
					detail: file.path.join(" / "),
					at: file.purgeAt,
					link: TRASH_LINK,
				}));
			return [...endingShares, ...purgeSoon].sort((first, second) =>
				first.at.localeCompare(second.at),
			);
		},
	});
}
