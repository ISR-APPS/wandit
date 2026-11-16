// One calendar item as a small tinted button: the channel mark, the time, and the title.
// The chip is a size container: under 10rem it hides the time, and under 6rem the mark too. The tint still shows the channel.
// MonthGrid renders up to three chips per day, and the day dialog and the agenda list render one per item.
// A click opens the item dialog of CalendarPage.
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
	/** "compact" fits a month cell: a smaller text, the title on up to two lines. "row" fits a list. */
	size?: "compact" | "row";
};

/** A published item has muted text, so the work still to do stands out. */
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
	const isPublished = item.status === "published";
	return (
		<button
			type="button"
			onClick={() => onOpen(item.id)}
			className={cn(
				"@container flex w-full min-w-0 items-center gap-1.5 rounded-sm text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
				CHANNEL_TINT[item.channel],
				size === "compact"
					? "px-1.5 py-1 text-xs"
					: "min-h-11 px-3 py-2 text-sm",
				isPublished && "text-muted-foreground",
			)}
		>
			<ChannelMark channel={item.channel} className="@max-[6rem]:hidden" />
			<span className="@[10rem]:inline hidden shrink-0 tabular-nums">
				{time}
			</span>
			{/* A month cell is narrow, so a compact title takes two lines and splits long words at a hyphen. */}
			<span
				className={cn(
					"min-w-0 font-medium",
					size === "compact" ? "line-clamp-2 hyphens-auto" : "truncate",
				)}
			>
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
