// The wall of one zone of the floor: the zone name, its tables and guests, and one tile per table.
// FloorPage renders one wall per zone. The tiles keep the order of the floor plan, so a table keeps its place.
// It reads the floor board entries of its zone. It writes nothing.
import {
	type FloorTable,
	fillMessage,
	guestsAt,
	type Zone,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { TableTile } from "./table-tile";

type TableWallProps = {
	zone: Zone;
	/** The tables of this zone, in the order of the floor plan. */
	entries: FloorTable[];
	/** The column class of the tile grid. FloorPage gives each zone the width of its share of the floor. */
	columnsClassName: string;
	/** Milliseconds since 1970 at render, shared by every tile of the page. */
	now: number;
};

/** A section with a heading row and a grid of tiles. 2 columns on a phone. */
export function TableWall({
	zone,
	entries,
	columnsClassName,
	now,
}: TableWallProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const guests = guestsAt(entries);
	const headingId = `zone-${zone}`;

	return (
		<section aria-labelledby={headingId} className="grid content-start gap-3">
			<div className="flex items-baseline justify-between gap-3">
				<h2 id={headingId} className="font-semibold text-base">
					{t(`zones.${zone}`)}
				</h2>
				<span className="text-muted-foreground text-xs tabular-nums">
					{fillMessage(t("floor.zoneSummary"), {
						tables: number.format(entries.length),
						guests: number.format(guests),
					})}
				</span>
			</div>
			<div className={cn("grid grid-cols-2 gap-3", columnsClassName)}>
				{entries.map((entry) => (
					<TableTile key={entry.table.id} entry={entry} now={now} />
				))}
			</div>
		</section>
	);
}
