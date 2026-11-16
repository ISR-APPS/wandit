// The icon tile of a track: one icon and one chart color per subject area of the school.
// The course cards, the course page, and the side panels render it beside a course title.
// The tile is a tint of a chart token, so ink text and icons keep their contrast on it.
import {
	BriefcaseIcon,
	ChartLineUpIcon,
	CodeIcon,
	MegaphoneIcon,
	PaletteIcon,
} from "@phosphor-icons/react";
import { cn } from "~/shared/lib/utils";
import type { KitIcon } from "~/shared/ui/icons";
import type { Track } from "../lib/catalog";

/** The icon of each track. */
const TRACK_ICONS = {
	design: PaletteIcon,
	data: ChartLineUpIcon,
	development: CodeIcon,
	marketing: MegaphoneIcon,
	business: BriefcaseIcon,
} satisfies Record<Track, KitIcon>;

/** The tint of each track, from the chart tokens of the theme. */
const TRACK_TINTS = {
	design: "bg-chart-2/25",
	data: "bg-chart-5/30",
	development: "bg-chart-1/20",
	marketing: "bg-chart-4/45",
	business: "bg-chart-3/30",
} satisfies Record<Track, string>;

type TrackTileProps = {
	/** The subject area of the course. */
	track: Track;
	/** Size classes of the tile and its icon, for example "size-9 [&_svg]:size-4". The default is size-11. */
	className?: string;
};

/** Decorative: the caller shows the track name or the course title next to it. */
export function TrackTile({ track, className }: TrackTileProps) {
	const TrackIcon = TRACK_ICONS[track];
	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex size-11 shrink-0 items-center justify-center rounded-control border border-border [&_svg]:size-5",
				TRACK_TINTS[track],
				className,
			)}
		>
			<TrackIcon />
		</span>
	);
}
