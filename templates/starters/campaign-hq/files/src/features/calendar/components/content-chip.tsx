// One calendar item as a small tinted button: the time, then the title, in the tint of its channel.
// MonthGrid renders the "compact" chip in its cells. The day dialog and the agenda render the "row" chip, with the channel mark and the campaign.
// A click opens the item dialog of CalendarPage. It follows the kit event chip: a past item has a line through its title.
import { type Channel, ChannelMark } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { ContentItem } from "../api/calendar.queries";

/** The tint of each channel. Yellow needs a stronger tint to show on white. The names stay whole for Tailwind. */
const CHANNEL_TINT = {
	paid_social: "bg-chart-1/15 hover:bg-chart-1/30",
	search: "bg-chart-2/30 hover:bg-chart-2/50",
	email: "bg-chart-3/20 hover:bg-chart-3/40",
	video: "bg-chart-4/20 hover:bg-chart-4/40",
	partners: "bg-chart-5/15 hover:bg-chart-5/30",
} satisfies Record<Channel, string>;

type ContentChipProps = {
	item: ContentItem;
	/** Opens the dialog of this item. */
	onOpen: (itemId: string) => void;
	/** "compact" fits a day cell: one line of text. "row" fits a list: a taller row with the channel mark and the campaign. */
	size?: "compact" | "row";
};

/** The screen reader text adds the status, because the line through the title is only visual. */
export function ContentChip({
	item,
	onOpen,
	size = "compact",
}: ContentChipProps) {
	const { t, locale } = useT();
	const time = new Intl.DateTimeFormat(locale, {
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(item.scheduledAt));
	// The query marks an item "published" once its time has passed, so the status tells a past item.
	const isPast = item.status === "published";
	return (
		<button
			type="button"
			onClick={() => onOpen(item.id)}
			className={cn(
				"flex w-full min-w-0 items-center gap-1 rounded-sm text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
				CHANNEL_TINT[item.channel],
				size === "compact"
					? "h-6 px-1 text-xs sm:px-2"
					: "min-h-11 gap-2 px-3 py-2 text-sm",
			)}
		>
			{size === "row" ? <ChannelMark channel={item.channel} /> : null}
			<span className="shrink-0 tabular-nums opacity-70 max-sm:hidden">
				{time}
			</span>
			<span className={cn("truncate font-medium", isPast && "line-through")}>
				{item.title}
			</span>
			{size === "row" ? (
				<span className="ms-auto hidden shrink-0 truncate text-muted-foreground text-xs sm:inline">
					{item.campaignName}
				</span>
			) : null}
			<span className="sr-only">{`, ${t(`contentStatus.${item.status}`)}`}</span>
		</button>
	);
}
