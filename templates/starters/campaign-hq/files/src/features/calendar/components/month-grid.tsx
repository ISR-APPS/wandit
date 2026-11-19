// The day grid of the calendar: a weekday row, then one cell per day with its item chips.
// CalendarPage renders it for the month view (5 or 6 weeks, three chips per cell) and the week view (one week, every chip).
// It follows the kit month view: thin rules between cells, muted cells outside the month, a round day number.
import { fillMessage } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { ContentItem } from "../api/calendar.queries";
import type { MonthCell } from "../lib/month";
import { ContentChip } from "./content-chip";

type MonthGridProps = {
	/** The cells to show, whole weeks from Monday. */
	cells: MonthCell[];
	/** The items of each day, keyed by YYYY-MM-DD, oldest first. */
	itemsByDay: Map<string, ContentItem[]>;
	/** Today as YYYY-MM-DD. Its day number gets the primary fill. */
	today: string;
	/** The most chips of one cell. A "+N more" button opens the day dialog for the rest. Absent: every chip. */
	chipLimit?: number;
	onOpenItem: (itemId: string) => void;
	/** Opens the dialog with every item of one day (YYYY-MM-DD). */
	onOpenDay: (day: string) => void;
};

/** The grid is a list of days for screen readers: each cell names its date. */
export function MonthGrid({
	cells,
	itemsByDay,
	today,
	chipLimit,
	onOpenItem,
	onOpenDay,
}: MonthGridProps) {
	const { t, locale } = useT();
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const dayNumber = new Intl.DateTimeFormat(locale, { day: "numeric" });
	const fullDay = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
	const number = new Intl.NumberFormat(locale);

	return (
		<div>
			<div className="grid grid-cols-7 border-b">
				{cells.slice(0, 7).map((cell) => (
					<div
						key={cell.day}
						className="py-2 text-center text-muted-foreground text-sm"
					>
						{weekday.format(new Date(cell.startMs))}
					</div>
				))}
			</div>
			<ul className="grid grid-cols-7">
				{cells.map((cell, index) => {
					const items = itemsByDay.get(cell.day) ?? [];
					const shown =
						chipLimit === undefined ? items : items.slice(0, chipLimit);
					const hidden = items.length - shown.length;
					const date = new Date(cell.startMs);
					return (
						<li
							key={cell.day}
							aria-label={fullDay.format(date)}
							className={cn(
								"flex min-w-0 flex-col gap-1 border-b p-1",
								// A month cell holds three chips. A week cell holds every chip of the day.
								chipLimit === undefined ? "min-h-96" : "min-h-32",
								// The last column has no end rule and the last week no bottom rule: the panel frame draws them.
								index % 7 !== 6 && "border-e",
								index >= cells.length - 7 && "border-b-0",
								!cell.inMonth && "bg-muted/25 text-muted-foreground",
							)}
						>
							<span
								className={cn(
									"inline-flex size-6 items-center justify-center self-start rounded-full text-sm tabular-nums",
									cell.day === today && "bg-primary text-primary-foreground",
								)}
							>
								{dayNumber.format(date)}
							</span>
							{shown.map((item) => (
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
									className="flex h-6 items-center self-stretch rounded-sm px-1 text-muted-foreground text-xs hover:bg-muted/50 hover:text-foreground sm:px-2"
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
