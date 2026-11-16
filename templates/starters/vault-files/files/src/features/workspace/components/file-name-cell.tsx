// The name cell of a file row: the kind tile, the file name as a link to its page, and its folder path or a detail.
// The overview, the Files list, the Shared page, and the Recent page render it. The trash renders it with no link.
import { Link } from "@tanstack/react-router";
import { useT } from "~/shared/i18n";
import type { FileKind } from "../lib/codes";
import { FileTile } from "./file-tile";

type FileNameCellProps = {
	/** The file id. With `linked`, the name opens /app/files/$fileId. */
	fileId: string;
	name: string;
	kind: FileKind;
	/** Folder names from the top folder down. An empty path shows "All files". */
	path: string[];
	/** A text for the second line in place of the path, for example the kind inside its own folder. */
	detail?: string;
	/** false for a file in the trash: it has no file page. */
	linked?: boolean;
};

/**
 * Two lines next to the tile. The lines truncate, so a long name never widens the table.
 * min-w-44 keeps the name readable on a phone: the table then scrolls sideways.
 */
export function FileNameCell({
	fileId,
	name,
	kind,
	path,
	detail,
	linked = true,
}: FileNameCellProps) {
	const { t } = useT();
	return (
		<div className="flex min-w-44 items-center gap-3">
			<FileTile kind={kind} />
			{/* justify-items-start: each line is as wide as its text, so dir="auto" text sits at the start side. */}
			<div className="grid min-w-0 max-w-72 justify-items-start">
				{linked ? (
					<Link
						to="/app/files/$fileId"
						params={{ fileId }}
						className="max-w-full truncate font-medium hover:underline"
						dir="auto"
					>
						{name}
					</Link>
				) : (
					<span className="max-w-full truncate font-medium" dir="auto">
						{name}
					</span>
				)}
				<span
					className="max-w-full truncate text-muted-foreground text-xs"
					dir="auto"
				>
					{detail ?? (path.length > 0 ? path.join(" / ") : t("files.allFiles"))}
				</span>
			</div>
		</div>
	);
}
