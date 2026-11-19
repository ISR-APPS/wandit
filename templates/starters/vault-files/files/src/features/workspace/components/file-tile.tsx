// The square mark of a file: the icon of its kind on a tint of its category.
// File name cells, grid cards, the file page, and the feed render it. It reads FILE_KIND_ICONS and the category.
// Each category uses one chart token, the same as its card on the home.
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

// The tint of each category: chart-1 to chart-4 in the order of FILE_CATEGORIES.
// The home type cards use the same chart token, so a color means one type everywhere.
// chart-3 and chart-4 are too light for a thin icon, so they draw the icon in a darker ink of the same hue.
const CATEGORY_TINTS = {
	documents: "bg-chart-1/12 text-chart-1",
	images: "bg-chart-2/15 text-chart-2",
	video: "bg-chart-3/25 text-primary",
	other: "bg-chart-4/20 text-muted-foreground",
} satisfies Record<FileCategory, string>;

// Box and icon size per use: an inline mark, a table row, a dialog, the header of the file page, and a large preview.
const TILE_SIZES = {
	xs: "size-6 rounded-sm [&_svg]:size-3.5",
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
