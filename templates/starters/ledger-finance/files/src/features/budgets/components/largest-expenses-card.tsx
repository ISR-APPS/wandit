// The card of the largest expenses of the month on the budgets page.
// BudgetsPage renders it in the rail. Each row opens the detail page of its transaction.
import { Link } from "@tanstack/react-router";
import {
	dayFormat,
	dayToDate,
	MoneyText,
	type Transaction,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type LargestExpensesCardProps = {
	/** The largest expenses of the month, the largest first. */
	rows: Transaction[];
};

/** A month with no expense shows one muted sentence in place of the list. */
export function LargestExpensesCard({ rows }: LargestExpensesCardProps) {
	const { t, locale } = useT();
	const day = dayFormat(locale);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("budgets.largestTitle")}</CardTitle>
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("budgets.largestEmpty")}
					</p>
				) : (
					<ol className="-my-3 grid">
						{rows.map((row) => (
							// The whole row is the link, so its touch area is 44 px high or more.
							<li key={row.id} className="border-t first:border-t-0">
								<Link
									to="/app/transactions/$transactionId"
									params={{ transactionId: row.id }}
									className="group flex min-h-11 items-center justify-between gap-4 py-3"
								>
									<span className="grid min-w-0 gap-0.5">
										<span
											className="truncate font-medium text-sm group-hover:underline"
											dir="auto"
										>
											{row.payee}
										</span>
										<span className="truncate text-muted-foreground text-xs">
											<span className="tabular-nums">
												{day.format(dayToDate(row.day))}
											</span>
											{" · "}
											{t(`categories.${row.categoryId}`)}
										</span>
									</span>
									<MoneyText
										amountCents={-row.amountCents}
										className="text-sm"
									/>
								</Link>
							</li>
						))}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}
