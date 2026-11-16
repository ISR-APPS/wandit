// The agenda of the month: one block per day that has items, with one row per item.
// CalendarPage renders it below the small container width, where a month grid has no room.
// In the current month it starts at today. A button above shows the earlier days.
import { useState } from "react";
import { fillMessage } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import type { ContentItem } from "../api/calendar.queries";
import { ContentChip } from "./content-chip";

type AgendaListProps = {
	/** The days of the month that have items, oldest first, as YYYY-MM-DD with their items. */
	days: { day: string; startMs: number; items: ContentItem[] }[];
	/** Today as YYYY-MM-DD. Its heading gets the primary mark. */
	today: string;
	onOpenItem: (itemId: string) => void;
};

/** The parent shows the empty sentence when no day has an item. A past or a future month shows every day. */
export function AgendaList({ days, today, onOpenItem }: AgendaListProps) {
	const { t, locale } = useT();
	const [showEarlier, setShowEarlier] = useState(false);
	const heading = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
	// YYYY-MM-DD keys sort as dates.
	const earlierDays = days.filter((entry) => entry.day < today);
	const laterDays = days.filter((entry) => entry.day >= today);
	// A past month has no later day and a future month has no earlier day, so both show every day.
	const hidesEarlier =
		!showEarlier && earlierDays.length > 0 && laterDays.length > 0;
	const earlierCount = earlierDays.reduce(
		(sum, entry) => sum + entry.items.length,
		0,
	);
	const shownDays = hidesEarlier ? laterDays : days;

	return (
		<div className="grid gap-5">
			{hidesEarlier ? (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="justify-self-start max-md:min-h-11"
					onClick={() => setShowEarlier(true)}
				>
					{fillMessage(
						t(
							earlierCount === 1
								? "calendar.showEarlierOne"
								: "calendar.showEarlier",
						),
						{ count: new Intl.NumberFormat(locale).format(earlierCount) },
					)}
				</Button>
			) : null}
			<ol className="grid gap-5">
				{shownDays.map((entry) => (
					<li key={entry.day} className="grid gap-2">
						<h2
							className={cn(
								"flex items-center gap-2 font-sans font-semibold text-sm",
								entry.day !== today && "text-muted-foreground",
							)}
						>
							{entry.day === today ? (
								<span
									aria-hidden="true"
									className="size-2 rounded-full bg-primary"
								/>
							) : null}
							{heading.format(new Date(entry.startMs))}
						</h2>
						<ul className="grid gap-1.5">
							{entry.items.map((item) => (
								<li key={item.id}>
									<ContentChip item={item} onOpen={onOpenItem} size="row" />
								</li>
							))}
						</ul>
					</li>
				))}
			</ol>
		</div>
	);
}
