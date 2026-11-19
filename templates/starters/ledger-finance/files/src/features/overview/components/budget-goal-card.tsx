// The budget card of the home: what the budgeted categories spent this month against the sum of their limits.
// OverviewPage renders it in the last band with the current month of budgetReportQueryOptions.
// The button opens the budgets page.
import { Link } from "@tanstack/react-router";
import {
	dayToDate,
	fillMessage,
	MoneyText,
	monthFormat,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";

type BudgetGoalCardProps = {
	/** The spend of every budget this month, in cents. */
	spentCents: number;
	/** The sum of every monthly limit, in cents. */
	budgetedCents: number;
	/** The first day of the month, as `YYYY-MM-DD`. */
	monthStart: string;
};

/** A spend over the limits fills the bar. The share in the description then reads above 100 %. */
export function BudgetGoalCard({
	spentCents,
	budgetedCents,
	monthStart,
}: BudgetGoalCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const share = budgetedCents > 0 ? spentCents / budgetedCents : 0;
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.budgetTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("overview.budgetDescription"), {
						share: percent.format(share),
						month: monthFormat(locale).format(dayToDate(monthStart)),
					})}
				</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<Link to="/app/budgets">{t("overview.openBudgets")}</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				<p className="flex flex-wrap items-baseline gap-x-2">
					<MoneyText
						amountCents={spentCents}
						withCents={false}
						className="text-4xl"
					/>
					<span className="text-muted-foreground text-sm">
						{t("overview.of")}{" "}
						<MoneyText amountCents={budgetedCents} withCents={false} />
					</span>
				</p>
				<Progress
					value={spentCents}
					max={budgetedCents}
					className="h-3"
					aria-label={t("overview.budgetTitle")}
				/>
			</CardContent>
		</Card>
	);
}
