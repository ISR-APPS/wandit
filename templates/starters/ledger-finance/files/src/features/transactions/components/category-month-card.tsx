// The second card of the transaction page, in the kit progress card form: one bar and its percent.
// With a budget, the bar is the spend of the category in the month against its limit.
// With no budget, the bar is the share of this entry in the month of its category. A transfer has no month card.
import {
	dayToDate,
	fillMessage,
	MoneyText,
	monthFormat,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { TransactionRow } from "../api/transactions.queries";
import type { CategoryMonth } from "../lib/transaction-detail";

type CategoryMonthCardProps = {
	transaction: TransactionRow;
	/** The total of the category in the month. null for a transfer or for a month that the history cuts. */
	categoryMonth: CategoryMonth | null;
};

/** The percent sits beside the bar, so the bar is never the only mark. */
export function CategoryMonthCard({
	transaction,
	categoryMonth,
}: CategoryMonthCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const category = t(`categories.${transaction.categoryId}`);
	if (categoryMonth === null) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{t("transactions.budgetTitle")}</CardTitle>
					<CardDescription>
						{transaction.type === "transfer"
							? t("transactions.transferNoBudget")
							: t("transactions.monthCut")}
					</CardDescription>
				</CardHeader>
			</Card>
		);
	}
	const { limitCents } = categoryMonth;
	// The month total holds this entry, so it is never 0.
	const share =
		limitCents !== null
			? categoryMonth.totalCents / limitCents
			: Math.abs(transaction.amountCents) / categoryMonth.totalCents;
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					{fillMessage(t("transactions.categoryMonth"), {
						category,
						month: monthFormat(locale).format(
							dayToDate(categoryMonth.monthStart),
						),
					})}
				</CardTitle>
				<CardDescription>
					{limitCents !== null ? (
						<>
							<MoneyText amountCents={categoryMonth.totalCents} />{" "}
							{t("transactions.ofBudget")}{" "}
							<MoneyText amountCents={limitCents} withCents={false} />
						</>
					) : (
						t("transactions.shareOfMonth")
					)}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex items-center gap-4">
				<Progress
					value={share * 100}
					aria-label={category}
					className="flex-1"
				/>
				<span className="text-muted-foreground text-sm tabular-nums">
					{percent.format(share)}
				</span>
			</CardContent>
		</Card>
	);
}
