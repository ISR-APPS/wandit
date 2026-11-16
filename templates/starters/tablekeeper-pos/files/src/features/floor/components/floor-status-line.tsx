// The status line under the floor title: one dot, the count, and the word per table status, then the guests in house.
// FloorPage puts it in the description of its header. It shows only the statuses that have tables.
// A free table in a closed zone counts as closed, not as free, as on its tile.
// It reads the floor board entries. It writes nothing.
import {
	type FloorTable,
	fillMessage,
	guestsAt,
	TABLE_STATUS_DOT,
	TABLE_STATUSES,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type FloorStatusLineProps = {
	/** Every table of the floor with its live status. */
	entries: FloorTable[];
};

/** A wrapping row of counts. It wraps under the title at 375 px. */
export function FloorStatusLine({ entries }: FloorStatusLineProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const guests = guestsAt(entries);
	const closed = entries.filter((entry) => entry.closedZone).length;
	const counts = TABLE_STATUSES.map((status) => ({
		status,
		count: entries.filter(
			(entry) => entry.status === status && !entry.closedZone,
		).length,
	})).filter((item) => item.count > 0);

	return (
		<span className="flex flex-wrap items-center gap-x-4 gap-y-1">
			<span className="sr-only">{t("floor.statusLine")}</span>
			{counts.map((item) => (
				<span key={item.status} className="flex items-center gap-1.5">
					<span
						aria-hidden="true"
						className={cn("size-2 rounded-full", TABLE_STATUS_DOT[item.status])}
					/>
					<span className="font-medium text-foreground tabular-nums">
						{number.format(item.count)}
					</span>
					{t(`tableStatuses.${item.status}`)}
				</span>
			))}
			{closed > 0 ? (
				<span className="flex items-center gap-1.5">
					<span
						aria-hidden="true"
						className={cn("size-2 rounded-full", TABLE_STATUS_DOT.free)}
					/>
					<span className="font-medium text-foreground tabular-nums">
						{number.format(closed)}
					</span>
					{t("floor.closed")}
				</span>
			) : null}
			<span className="text-foreground tabular-nums">
				{fillMessage(t("floor.guestsInHouse"), {
					count: number.format(guests),
				})}
			</span>
		</span>
	);
}
