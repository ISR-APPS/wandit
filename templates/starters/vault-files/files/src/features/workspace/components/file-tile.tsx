// The square mark of a file: the icon of its kind on a tint of its category.
// File name cells, grid cards, the file page, and the feed render it. It reads FILE_KIND_ICONS and the category.
// Each category uses the chart token of its series in the uploads chart, so a color means one type everywhere.
import {
	FileArchiveIcon,
	FileAudioIcon,
	FileCodeIcon,
	FileDocIcon,
	FileImageIcon,
	FilePdfIcon,
	FilePptIcon,
	FileVideoIcon,
	FileXlsIcon,
	PenNibIcon,
} from "@phosphor-icons/react";
import { cn } from "~/shared/lib/utils";
import type { KitIcon } from "~/shared/ui/icons";
import {
	CATEGORY_OF_KIND,
	type FileCategory,
	type FileKind,
} from "../lib/codes";

// The icon of each file kind.
const FILE_KIND_ICONS = {
	document: FileDocIcon,
	pdf: FilePdfIcon,
	spreadsheet: FileXlsIcon,
	presentation: FilePptIcon,
	image: FileImageIcon,
	video: FileVideoIcon,
	design: PenNibIcon,
	archive: FileArchiveIcon,
	code: FileCodeIcon,
	audio: FileAudioIcon,
} satisfies Record<FileKind, KitIcon>;

// The tint of each category: chart-1 to chart-5 in the stack order of FILE_CATEGORIES.
// chart-5 is too light for an icon, so "other" keeps the muted text color on its tint.
const CATEGORY_TINTS = {
	documents: "bg-chart-1/12 text-chart-1",
	images: "bg-chart-2/15 text-chart-2",
	// chart-3 is too light for a thin icon, so video draws the icon in primary, the same hue.
	video: "bg-chart-3/25 text-primary",
	design: "bg-chart-4/15 text-chart-4",
	other: "bg-chart-5/25 text-muted-foreground",
} satisfies Record<FileCategory, string>;

// Box and icon size per use: a table row, a dialog, the header of the file page, and the preview of a grid card.
const TILE_SIZES = {
	sm: "size-8 rounded-md [&_svg]:size-4.5",
	md: "size-10 rounded-lg [&_svg]:size-5.5",
	lg: "size-24 rounded-xl [&_svg]:size-12",
	preview: "aspect-[4/3] w-full rounded-md [&_svg]:size-10",
} as const;

type FileTileProps = {
	kind: FileKind;
	size?: keyof typeof TILE_SIZES;
	className?: string;
};

/** The kind mark of one file. The name next to it carries the meaning, so the icon stays hidden from screen readers. */
export function FileTile({ kind, size = "sm", className }: FileTileProps) {
	const Icon = FILE_KIND_ICONS[kind];
	return (
		<span
			aria-hidden
			className={cn(
				"inline-flex shrink-0 items-center justify-center",
				TILE_SIZES[size],
				CATEGORY_TINTS[CATEGORY_OF_KIND[kind]],
				className,
			)}
		>
			<Icon />
		</span>
	);
}
