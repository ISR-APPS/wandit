// One column of the deal board: the stage with its count and amount, then the cards of its deals.
// DealsPage renders one column per stage of the winning path, inside a row that scrolls sideways.
import { Link } from "@tanstack/react-router";
import { fillMessage, moneyFormat, STAGE_DOT } from "~/features/crm";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import {
	type BoardColumn as BoardColumnData,
	COLUMN_CARDS,
} from "../lib/board";
import { DealCard } from "./deal-card";

type BoardColumnProps = {
	column: BoardColumnData;
	/** The current time in milliseconds since 1970. The cards count the age in the stage from it. */
	now: number;
};

/** A column shows its first COLUMN_CARDS cards. A link opens the rest in the table view, on the tab of the stage. */
export function BoardColumn({ column, now }: BoardColumnProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const compactMoney = moneyFormat(locale, "compact");
	const hiddenCount = column.deals.length - COLUMN_CARDS;
	const label = t(`stages.${column.stage}`);
	return (
		<section
			aria-label={label}
			className="flex w-72 shrink-0 flex-col gap-3 rounded-surface bg-muted p-3"
		>
			<div className="flex items-center gap-2 px-1">
				<span
					aria-hidden="true"
					className={cn("size-2 rounded-full", STAGE_DOT[column.stage])}
				/>
				<h2 className="font-semibold text-sm">{label}</h2>
				<Badge variant="outline" className="tabular-nums">
					{number.format(column.deals.length)}
				</Badge>
				<span className="ms-auto font-medium text-muted-foreground text-sm tabular-nums">
					{compactMoney.format(column.amount)}
				</span>
			</div>
			{column.deals.length === 0 ? (
				// An empty column keeps one slot, so the board keeps its shape.
				<p className="rounded-surface border border-dashed px-3 py-6 text-center text-muted-foreground text-xs">
					{t("deals.emptyColumn")}
				</p>
			) : (
				column.deals
					.slice(0, COLUMN_CARDS)
					.map((deal) => <DealCard key={deal.id} deal={deal} now={now} />)
			)}
			{hiddenCount > 0 ? (
				<Link
					to="/app/deals"
					search={{ view: "table", stage: column.stage }}
					className="rounded-control px-1 py-1 text-muted-foreground text-sm underline decoration-border underline-offset-4 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					{fillMessage(t("deals.more"), {
						count: number.format(hiddenCount),
					})}
				</Link>
			) : null}
		</section>
	);
}
