// The month grid of the calendar: a weekday header and one cell per day with up to three item chips.
// CalendarPage renders it from the small container width. Narrower, AgendaList shows the same items.
import { fillMessage } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { ContentItem } from "../api/calendar.queries";
import type { MonthCell } from "../lib/month";
import { ContentChip } from "./content-chip";

// A cell shows this many chips. A "+N more" button opens the day dialog for the rest.
const CHIPS_PER_CELL = 3;

type MonthGridProps = {
	/** The cells of the month, whole weeks from Monday. */
	cells: MonthCell[];
	/** The items of each day, keyed by YYYY-MM-DD, oldest first. */
	itemsByDay: Map<string, ContentItem[]>;
	/** Today as YYYY-MM-DD. Its day number gets the primary fill. */
	today: string;
	onOpenItem: (itemId: string) => void;
	/** Opens the dialog with every item of one day (YYYY-MM-DD). */
	onOpenDay: (day: string) => void;
};

/** The grid is a list of weeks for screen readers: each cell names its date. */
export function MonthGrid({
	cells,
	itemsByDay,
	today,
	onOpenItem,
	onOpenDay,
}: MonthGridProps) {
	const { t, locale } = useT();
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const dayNumber = new Intl.DateTimeFormat(locale, { day: "numeric" });
	const fullDay = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
	const number = new Intl.NumberFormat(locale);

	return (
		<div className="overflow-hidden rounded-control border">
			<div className="grid grid-cols-7 border-b bg-muted text-muted-foreground text-xs">
				{cells.slice(0, 7).map((cell) => (
					<div key={cell.day} className="px-2 py-2 font-medium">
						{weekday.format(new Date(cell.startMs))}
					</div>
				))}
			</div>
			<ul className="grid grid-cols-7">
				{cells.map((cell, index) => {
					const items = itemsByDay.get(cell.day) ?? [];
					const hidden = items.length - CHIPS_PER_CELL;
					const isToday = cell.day === today;
					const date = new Date(cell.startMs);
					return (
						<li
							key={cell.day}
							aria-label={fullDay.format(date)}
							className={cn(
								"grid min-h-32 min-w-0 content-start gap-1 border-b p-1.5",
								// The last column has no end rule: the frame draws it.
								index % 7 !== 6 && "border-e",
								// The last week has no bottom rule: the frame draws it.
								index >= cells.length - 7 && "border-b-0",
								!cell.inMonth && "bg-muted/60",
							)}
						>
							<span
								className={cn(
									"flex size-6 items-center justify-center justify-self-start rounded-full text-xs tabular-nums",
									isToday
										? "bg-primary font-semibold text-primary-foreground"
										: cell.inMonth
											? "text-foreground"
											: "text-muted-foreground",
								)}
							>
								{dayNumber.format(date)}
							</span>
							{items.slice(0, CHIPS_PER_CELL).map((item) => (
								<ContentChip key={item.id} item={item} onOpen={onOpenItem} />
							))}
							{hidden > 0 ? (
								<button
									type="button"
									onClick={() => onOpenDay(cell.day)}
									aria-label={fillMessage(
										t(
											hidden === 1
												? "calendar.moreLabelOne"
												: "calendar.moreLabel",
										),
										{
											count: number.format(hidden),
											day: fullDay.format(date),
										},
									)}
									className="justify-self-start rounded-sm px-1.5 py-0.5 font-medium text-muted-foreground text-xs hover:bg-accent hover:text-accent-foreground"
								>
									{fillMessage(t("calendar.more"), {
										count: number.format(hidden),
									})}
								</button>
							) : null}
						</li>
					);
				})}
			</ul>
		</div>
	);
}
