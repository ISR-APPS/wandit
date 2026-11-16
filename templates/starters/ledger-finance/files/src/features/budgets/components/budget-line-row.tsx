// One budget of the budgets page: the category, its status, the spend against the limit, and the bar.
// BudgetLinesCard renders one row per budget. A click opens the sheet with the expenses of the category.
import { countLabel, MoneyText } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import type { BudgetLine } from "../lib/budget-report";
import { BUDGET_STATUS_BADGE } from "../lib/budget-status";
import { BudgetBar } from "./budget-bar";

type BudgetLineRowProps = {
	line: BudgetLine;
	/** The share of the month that passed, from 0 to 1. null for a closed month. */
	monthShare: number | null;
	/** Opens the sheet of this budget. */
	onOpen: () => void;
};

/** The whole row is one button. Its text names the category, the status, and the figures. */
export function BudgetLineRow({
	line,
	monthShare,
	onOpen,
}: BudgetLineRowProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const leftCents = line.limitCents - line.spentCents;

	return (
		<li className="border-t first:border-t-0">
			<button
				type="button"
				onClick={onOpen}
				className="grid w-full gap-2.5 px-6 py-4 text-start outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
			>
				<span className="@2xl/main:flex grid @2xl/main:items-center @2xl/main:justify-between gap-x-4 gap-y-1">
					<span className="flex items-center gap-2">
						<span className="font-medium">
							{t(`categories.${line.categoryId}`)}
						</span>
						<Badge variant={BUDGET_STATUS_BADGE[line.status]}>
							{t(`budgets.statuses.${line.status}`)}
						</Badge>
					</span>
					<span className="flex items-baseline gap-2 text-sm">
						<MoneyText amountCents={line.spentCents} className="font-medium" />
						<span className="text-muted-foreground">
							{t("budgets.of")}{" "}
							<MoneyText amountCents={line.limitCents} withCents={false} />
						</span>
						<span className="w-11 text-end font-numeric text-muted-foreground tabular-nums">
							{percent.format(line.spentCents / line.limitCents)}
						</span>
					</span>
				</span>
				<BudgetBar
					spentCents={line.spentCents}
					limitCents={line.limitCents}
					status={line.status}
					monthShare={monthShare}
				/>
				<span className="flex flex-wrap justify-between gap-x-4 text-muted-foreground text-xs">
					<span>
						{t(`budgets.rhythms.${line.rhythm}`)}
						{" · "}
						{countLabel(
							line.transactions.length,
							t("transactions.entriesOne"),
							t("transactions.entriesOther"),
							locale,
						)}
					</span>
					<span>
						<MoneyText amountCents={Math.abs(leftCents)} />{" "}
						{t(leftCents >= 0 ? "budgets.left" : "budgets.over")}
					</span>
				</span>
			</button>
		</li>
	);
}
