// The dialog of one day of the calendar: every item of that day, one row each.
// CalendarPage opens it from the "+N more" button of a month cell. A row opens the item dialog.
import { dayToDate, fillMessage } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/shared/ui/dialog";
import type { ContentItem } from "../api/calendar.queries";
import { ContentChip } from "./content-chip";

type DayItemsDialogProps = {
	/** The day as YYYY-MM-DD, or null when no day is open. */
	day: string | null;
	/** The items of the day, oldest first. */
	items: ContentItem[];
	onOpenChange: (open: boolean) => void;
	onOpenItem: (itemId: string) => void;
};

/** Open while `day` is set. */
export function DayItemsDialog({
	day,
	items,
	onOpenChange,
	onOpenItem,
}: DayItemsDialogProps) {
	const { t, locale } = useT();
	// The day key is midnight UTC, so the UTC time zone keeps the same calendar day.
	const heading = new Intl.DateTimeFormat(locale, {
		dateStyle: "full",
		timeZone: "UTC",
	});
	return (
		<Dialog open={day !== null} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{day ? heading.format(dayToDate(day)) : ""}</DialogTitle>
					<DialogDescription>
						{fillMessage(
							t(
								items.length === 1
									? "calendar.dayItemsOne"
									: "calendar.dayItems",
							),
							{
								count: new Intl.NumberFormat(locale).format(items.length),
							},
						)}
					</DialogDescription>
				</DialogHeader>
				<ul className="grid gap-1.5">
					{items.map((item) => (
						<li key={item.id}>
							<ContentChip item={item} onOpen={onOpenItem} size="row" />
						</li>
					))}
				</ul>
			</DialogContent>
		</Dialog>
	);
}
