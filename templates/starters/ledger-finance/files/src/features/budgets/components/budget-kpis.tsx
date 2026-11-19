// The KPI row of the budgets page in the kit "tile" form: the total budget, the spend, what is left, and the
// budgets over their limit. BudgetsPage renders it under the page header. It uses KpiTile of the shared UI.
import {
	CoinsIcon,
	HourglassIcon,
	ReceiptIcon,
	WarningIcon,
} from "@phosphor-icons/react";
import { dayCountFormat, fillMessage, MoneyText } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { KpiTile } from "~/shared/ui/kpi-tile";
import type { BudgetReport } from "../lib/budget-report";

type BudgetKpisProps = {
	/** The report of the month that the page shows. */
	report: BudgetReport;
};

/** The figures sum the budget rows of the page, so each one agrees with the list under the row. */
export function BudgetKpis({ report }: BudgetKpisProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const leftCents = report.budgetedCents - report.spentCents;
	const daysLeft = report.dayCount - report.elapsedDays;
	const overCount = report.lines.filter(
		(line) => line.status === "over",
	).length;
	const aheadCount = report.lines.filter(
		(line) => line.status === "ahead",
	).length;

	return (
		<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
			<KpiTile label={t("budgets.budgeted")} icon={CoinsIcon}>
				<MoneyText
					amountCents={report.budgetedCents}
					withCents={false}
					className="font-medium text-2xl"
				/>
				<p className="text-muted-foreground text-xs">
					{fillMessage(t("budgets.categoryCount"), {
						count: number.format(report.lines.length),
					})}
				</p>
			</KpiTile>
			<KpiTile label={t("budgets.spent")} icon={ReceiptIcon}>
				<MoneyText
					amountCents={report.spentCents}
					withCents={false}
					className="font-medium text-2xl"
				/>
				<p className="text-muted-foreground text-xs">
					{fillMessage(t("budgets.shareOfBudget"), {
						// With no budget the share has no meaning, so a dash replaces "NaN%".
						share:
							report.budgetedCents > 0
								? percent.format(report.spentCents / report.budgetedCents)
								: "–",
					})}
				</p>
			</KpiTile>
			<KpiTile
				label={t(leftCents >= 0 ? "budgets.leftTitle" : "budgets.overTitle")}
				icon={HourglassIcon}
			>
				<MoneyText
					amountCents={Math.abs(leftCents)}
					withCents={false}
					className="font-medium text-2xl"
				/>
				<p className="text-muted-foreground text-xs">
					{daysLeft > 0
						? fillMessage(t("budgets.daysLeft"), {
								days: dayCountFormat(locale).format(daysLeft),
							})
						: t("budgets.monthClosed")}
				</p>
			</KpiTile>
			<KpiTile label={t("budgets.overCount")} icon={WarningIcon}>
				<p className="font-medium font-numeric text-2xl tabular-nums">
					{number.format(overCount)}
					<span className="text-base text-muted-foreground">
						{` / ${number.format(report.lines.length)}`}
					</span>
				</p>
				<p className="text-muted-foreground text-xs">
					{/* A closed month has no pace, so it counts the budgets that ended inside their limit. */}
					{daysLeft > 0
						? fillMessage(t("budgets.aheadCount"), {
								count: number.format(aheadCount),
							})
						: fillMessage(t("budgets.withinCount"), {
								count: number.format(report.lines.length - overCount),
							})}
				</p>
			</KpiTile>
		</div>
	);
}
