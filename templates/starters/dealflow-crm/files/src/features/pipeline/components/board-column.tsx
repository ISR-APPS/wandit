// One column of the pipeline board: the stage with its count and amount, then the slips of its deals.
// PipelinePage renders one column per stage of the winning path.
import { Link } from "@tanstack/react-router";
import { fillMessage, moneyFormat, STAGE_DOT } from "~/features/crm";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	type BoardColumn as BoardColumnData,
	COLUMN_SLIPS,
} from "../lib/board";
import { DealSlip } from "./deal-slip";

type BoardColumnProps = {
	column: BoardColumnData;
	/** The current time in milliseconds since 1970. The slips count the age in the stage from it. */
	now: number;
};

/** A column shows its first COLUMN_SLIPS slips. A link opens the rest in the deal list, on the tab of the stage. */
export function BoardColumn({ column, now }: BoardColumnProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const compactMoney = moneyFormat(locale, "compact");
	const hiddenCount = column.deals.length - COLUMN_SLIPS;
	return (
		<div className="flex min-h-64 snap-start flex-col gap-2 rounded-surface bg-muted p-2">
			<div className="grid gap-1 px-1.5 pt-1.5 pb-1">
				<div className="flex items-center gap-2">
					<span
						aria-hidden="true"
						className={cn("size-2 rounded-full", STAGE_DOT[column.stage])}
					/>
					<h2 className="font-semibold text-sm">
						{t(`stages.${column.stage}`)}
					</h2>
					<span className="ms-auto rounded-full bg-background px-2 py-0.5 font-medium text-muted-foreground text-xs tabular-nums">
						{number.format(column.deals.length)}
					</span>
				</div>
				<p className="font-numeric font-semibold text-xl tabular-nums">
					{compactMoney.format(column.amount)}
				</p>
			</div>
			{column.deals.length === 0 ? (
				// An empty column keeps one slot, so the board keeps its shape.
				<p className="rounded-surface border border-dashed px-3 py-6 text-center text-muted-foreground text-xs">
					{t("pipeline.emptyColumn")}
				</p>
			) : (
				column.deals
					.slice(0, COLUMN_SLIPS)
					.map((deal) => <DealSlip key={deal.id} deal={deal} now={now} />)
			)}
			{hiddenCount > 0 ? (
				<Link
					to="/app/deals"
					search={{ stage: column.stage }}
					className="rounded-control px-1.5 py-1 text-muted-foreground text-sm underline decoration-border underline-offset-4 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					{fillMessage(t("pipeline.more"), {
						count: number.format(hiddenCount),
					})}
				</Link>
			) : null}
		</div>
	);
}
