// One column of the board: the stage with its dot, its count, and its short hint, then the slips of its matters.
// BoardPage renders one column per stage of the path, from intake to closed.
import { Link } from "@tanstack/react-router";
import { fillMessage, MATTER_STAGE_DOT } from "~/features/practice";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	type BoardColumn as BoardColumnData,
	COLUMN_SLIPS,
} from "../lib/board";
import { MatterSlip } from "./matter-slip";

type BoardColumnProps = {
	column: BoardColumnData;
	/** The current time in milliseconds since 1970. The slips count the age and the deadlines from it. */
	now: number;
};

/**
 * A column shows its first COLUMN_SLIPS slips. A link opens the rest in the matter list, on the tab of the stage.
 * The closed column shows only BOARD_DAYS days, but its tab lists every closed matter, so its link has no count.
 */
export function BoardColumn({ column, now }: BoardColumnProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const hiddenCount = column.matters.length - COLUMN_SLIPS;
	const isClosed = column.stage === "closed";
	return (
		<div className="flex min-h-64 snap-start flex-col gap-2.5 rounded-surface bg-muted/70 p-2">
			<div className="grid gap-0.5 px-1.5 pt-1.5 pb-1">
				<div className="flex items-center gap-2">
					<span
						aria-hidden="true"
						className={cn(
							"size-2 rounded-full",
							MATTER_STAGE_DOT[column.stage],
						)}
					/>
					<h2 className="font-display font-semibold text-base">
						{t(`stages.${column.stage}`)}
					</h2>
					<span className="ms-auto rounded-full bg-background px-2 py-0.5 font-medium text-muted-foreground text-xs tabular-nums">
						{number.format(column.matters.length)}
					</span>
				</div>
				<p className="text-muted-foreground text-xs">
					{t(`stageHints.${column.stage}`)}
				</p>
			</div>
			{column.matters.length === 0 ? (
				// An empty column keeps one slot, so the board keeps its shape.
				<p className="rounded-surface border border-dashed px-3 py-6 text-center text-muted-foreground text-xs">
					{t("board.emptyColumn")}
				</p>
			) : (
				column.matters
					.slice(0, COLUMN_SLIPS)
					.map((matter) => (
						<MatterSlip key={matter.id} matter={matter} now={now} />
					))
			)}
			{isClosed || hiddenCount > 0 ? (
				// min-h-11: a touch area of 44 px on a phone.
				<Link
					to="/app/matters"
					search={{ stage: column.stage }}
					className="inline-flex min-h-11 items-center rounded-control px-1.5 text-muted-foreground text-sm underline decoration-border underline-offset-4 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					{isClosed
						? t("board.allClosed")
						: fillMessage(t("board.more"), {
								count: number.format(hiddenCount),
							})}
				</Link>
			) : null}
		</div>
	);
}
