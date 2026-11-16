// The totals strip of the Activity page: the amounts bought and sold, the rewards, and the fees.
// ActivityPage renders it above the table and gives it the rows of the active period and type.
// The totals count confirmed rows only; the note under the cells says so.
import { moneyFormat } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import type { Transaction } from "../api/transactions.queries";
import { sumActivity } from "../lib/activity-filters";

type ActivitySummaryProps = {
	/** The transactions of the active period and type tab, before the search. */
	transactions: Transaction[];
};

/** Four cells in one panel: 2 by 2 on a phone, one row from 48rem. */
export function ActivitySummary({ transactions }: ActivitySummaryProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const totals = sumActivity(transactions);
	const cells = [
		{ labelKey: "activity.bought", value: totals.bought },
		{ labelKey: "activity.sold", value: totals.sold },
		{ labelKey: "activity.rewards", value: totals.rewards },
		{ labelKey: "activity.fees", value: totals.fees },
	] as const;

	return (
		<Card className="gap-0 py-0">
			<CardContent className="px-0">
				<dl className="grid @3xl/main:grid-cols-4 grid-cols-2">
					{cells.map((cell) => (
						<div
							key={cell.labelKey}
							className="grid gap-1 @3xl/main:border-e border-t @3xl/main:border-t-0 @3xl/main:p-6 p-4 @3xl/main:last:border-e-0 odd:border-e [&:nth-child(-n+2)]:border-t-0"
						>
							<dt className="label-text text-muted-foreground text-sm">
								{t(cell.labelKey)}
							</dt>
							<dd className="font-numeric font-semibold @3xl/main:text-2xl text-xl tabular-nums">
								{money.format(cell.value)}
							</dd>
						</div>
					))}
				</dl>
				<p className="border-t @3xl/main:px-6 px-4 py-2.5 text-muted-foreground text-xs">
					{t("activity.summaryNote")}
				</p>
			</CardContent>
		</Card>
	);
}
