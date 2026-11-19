// The square mark of a folder: a folder icon on the muted fill, the same size steps as FileTile.
// The rows of the Files page render it next to a folder name.
import { FolderSimpleIcon } from "@phosphor-icons/react";
import { cn } from "~/shared/lib/utils";

// Box and icon size per use, the same steps as FileTile.
const FOLDER_SIZES = {
	xs: "size-6 rounded-sm [&_svg]:size-3.5",
	sm: "size-8 rounded-md [&_svg]:size-4.5",
	md: "size-10 rounded-lg [&_svg]:size-5.5",
} as const;

type FolderMarkProps = {
	/** xs sits inline before a name; sm sits in a table row; md sits on a card. */
	size?: "xs" | "sm" | "md";
};

/** A folder mark. The folder name next to it carries the meaning. */
export function FolderMark({ size = "sm" }: FolderMarkProps) {
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center justify-center bg-secondary text-foreground",
				FOLDER_SIZES[size],
			)}
		>
			<FolderSimpleIcon />
		</span>
	);
}
