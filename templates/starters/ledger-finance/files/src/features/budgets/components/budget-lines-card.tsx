// The list of budgets on the budgets page: one row per category, the most used first.
// BudgetsPage renders it in the main column and opens the sheet of a row after a click.
import { fillMessage } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Card, CardDescription, CardHeader, CardTitle } from "~/shared/ui/card";
import type { BudgetLine } from "../lib/budget-report";
import { BudgetLineRow } from "./budget-line-row";

type BudgetLinesCardProps = {
	lines: BudgetLine[];
	/** The share of the month that passed, from 0 to 1. null for a closed month. */
	monthShare: number | null;
	/** Runs with the budget of the row that the user opens. */
	onOpen: (line: BudgetLine) => void;
};

/** The description explains the thin mark on each bar, when the month is still open. */
export function BudgetLinesCard({
	lines,
	monthShare,
	onOpen,
}: BudgetLinesCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});

	return (
		<Card className="gap-0 overflow-hidden pb-0">
			<CardHeader className="pb-5">
				<CardTitle>{t("budgets.linesTitle")}</CardTitle>
				<CardDescription>
					{monthShare === null
						? t("budgets.linesClosed")
						: fillMessage(t("budgets.linesOpen"), {
								share: percent.format(monthShare),
							})}
				</CardDescription>
			</CardHeader>
			<ul className="border-t">
				{lines.map((line) => (
					<BudgetLineRow
						key={line.categoryId}
						line={line}
						monthShare={monthShare}
						onOpen={() => onOpen(line)}
					/>
				))}
			</ul>
		</Card>
	);
}
