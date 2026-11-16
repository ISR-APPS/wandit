// The square mark of a folder: a folder icon on the muted fill, the same size steps as FileTile.
// The list and the grid views of the Files page render it next to a folder name.
import { FolderSimpleIcon } from "@phosphor-icons/react";
import { cn } from "~/shared/lib/utils";

type FolderMarkProps = {
	/** sm sits in a table row; md sits on a grid card. */
	size?: "sm" | "md";
};

/** A folder mark. The folder name next to it carries the meaning. */
export function FolderMark({ size = "sm" }: FolderMarkProps) {
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center justify-center bg-secondary text-foreground",
				size === "sm"
					? "size-8 rounded-md [&_svg]:size-4.5"
					: "size-10 rounded-lg [&_svg]:size-5.5",
			)}
		>
			<FolderSimpleIcon />
		</span>
	);
}
