// The summary strip of the budgets page: the total budget, the spend, what is left, and the budgets over their limit.
// BudgetsPage renders it under the page header. It follows the KPI form "strip" of the app-dashboard skill:
// one panel, one cell per figure, split by rules.
import { fillMessage, MoneyText } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Card } from "~/shared/ui/card";
import type { BudgetReport } from "../lib/budget-report";

type BudgetSummaryStripProps = {
	report: BudgetReport;
};

/** The figures sum the budget rows of the page, so each one agrees with the list under the strip. */
export function BudgetSummaryStrip({ report }: BudgetSummaryStripProps) {
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
		// py-0 and gap-0 replace the py-6 and gap-6 of the kit Card, so the grid touches the panel edges.
		<Card className="gap-0 overflow-hidden py-0">
			{/* Each cell draws its top and start rule. The 1 px shift and the panel clip hide the rules at the panel edge, at any wrap. */}
			<div className="-ms-px -mt-px grid @4xl/main:grid-cols-4 grid-cols-2">
				<div className="grid content-start gap-1 border-s border-t px-6 py-5">
					<p className="label-text text-muted-foreground text-sm">
						{t("budgets.budgeted")}
					</p>
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
				</div>
				<div className="grid content-start gap-1 border-s border-t px-6 py-5">
					<p className="label-text text-muted-foreground text-sm">
						{t("budgets.spent")}
					</p>
					<MoneyText
						amountCents={report.spentCents}
						withCents={false}
						className="font-medium text-2xl"
					/>
					<p className="text-muted-foreground text-xs">
						{fillMessage(t("budgets.shareOfBudget"), {
							share: percent.format(report.spentCents / report.budgetedCents),
						})}
					</p>
				</div>
				<div className="grid content-start gap-1 border-s border-t px-6 py-5">
					<p className="label-text text-muted-foreground text-sm">
						{t(leftCents >= 0 ? "budgets.leftTitle" : "budgets.overTitle")}
					</p>
					<MoneyText
						amountCents={Math.abs(leftCents)}
						withCents={false}
						className="font-medium text-2xl"
					/>
					<p className="text-muted-foreground text-xs">
						{daysLeft > 0
							? fillMessage(t("budgets.daysLeft"), {
									days: new Intl.NumberFormat(locale, {
										style: "unit",
										unit: "day",
										unitDisplay: "long",
									}).format(daysLeft),
								})
							: t("budgets.monthClosed")}
					</p>
				</div>
				<div className="grid content-start gap-1 border-s border-t px-6 py-5">
					<p className="label-text text-muted-foreground text-sm">
						{t("budgets.overCount")}
					</p>
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
				</div>
			</div>
		</Card>
	);
}
