// One budget of the budgets page, in the kit "list with progress" row form: a top line (category, status,
// spend of limit, percent), the bar, then the rhythm and what is left.
// BudgetLinesCard renders one row per budget. A click opens the sheet with the expenses of the category.
import { CATEGORY_ICONS, countLabel, MoneyText } from "~/features/ledger";
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
	const Icon = CATEGORY_ICONS[line.categoryId];

	return (
		<li>
			<button
				type="button"
				onClick={onOpen}
				className="flex w-full items-center gap-4 rounded-md p-2 text-start outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
			>
				<span
					aria-hidden="true"
					className="flex size-10 shrink-0 items-center justify-center rounded-md border"
				>
					<Icon className="size-4" />
				</span>
				<span className="grid min-w-0 flex-1 gap-1.5">
					<span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
						<span className="flex items-center gap-2">
							<span className="font-medium">
								{t(`categories.${line.categoryId}`)}
							</span>
							<Badge variant={BUDGET_STATUS_BADGE[line.status]}>
								{t(`budgets.statuses.${line.status}`)}
							</Badge>
						</span>
						<span className="flex items-baseline gap-2">
							<MoneyText
								amountCents={line.spentCents}
								className="font-medium"
							/>
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
				</span>
			</button>
		</li>
	);
}
