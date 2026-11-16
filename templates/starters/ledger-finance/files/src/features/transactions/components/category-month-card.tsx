// The rail card of the transaction detail page that places the entry in its month:
// the total of its category, the share of this entry, and the budget of the category when it has one.
// TransactionDetailPage renders it for income and for expenses.
import {
	type CategoryId,
	countLabel,
	dayToDate,
	fillMessage,
	MoneyText,
	monthFormat,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { CategoryMonth } from "../lib/transaction-detail";

type CategoryMonthCardProps = {
	categoryId: CategoryId;
	/** The amount of the entry of the page without its sign, in cents. */
	entryCents: number;
	categoryMonth: CategoryMonth;
};

/** The bar shows the entry as the strong part of the month total. With a budget, the full bar is the limit. */
export function CategoryMonthCard({
	categoryId,
	entryCents,
	categoryMonth,
}: CategoryMonthCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const { totalCents, limitCents, entryCount, monthStart } = categoryMonth;
	// With a budget the bar is the limit. A month over its limit fills the bar, so the bar is the total then.
	const barCents = Math.max(limitCents ?? 0, totalCents);
	const shareOfTotal = totalCents === 0 ? 0 : entryCents / totalCents;

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					{fillMessage(t("transactions.categoryMonth"), {
						category: t(`categories.${categoryId}`),
						month: monthFormat(locale).format(dayToDate(monthStart)),
					})}
				</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-3">
				<p className="flex flex-wrap items-baseline gap-x-2">
					<MoneyText
						amountCents={totalCents}
						className="font-medium text-2xl"
					/>
					{limitCents === null ? null : (
						<span className="text-muted-foreground text-sm">
							{t("transactions.ofBudget")}{" "}
							<MoneyText amountCents={limitCents} withCents={false} />
						</span>
					)}
				</p>
				{/* Decoration: the sentence under the bar gives the same share as text. */}
				<div
					aria-hidden="true"
					className="flex h-2 overflow-hidden rounded-full bg-muted"
				>
					<span
						className="h-full bg-chart-5"
						style={{
							width: `${((totalCents - entryCents) / barCents) * 100}%`,
						}}
					/>
					<span
						className="h-full bg-chart-1"
						style={{ width: `${(entryCents / barCents) * 100}%` }}
					/>
				</div>
				{/* The dot has the color of the strong part of the bar, so the sentence works as its key. */}
				<p className="flex items-start gap-2 text-muted-foreground text-sm">
					{/* mt-1.5 centers the 8 px dot on the first 20 px line of the text. */}
					<span
						aria-hidden="true"
						className="mt-1.5 size-2 shrink-0 rounded-full bg-chart-1"
					/>
					{fillMessage(t("transactions.shareOfMonth"), {
						share: percent.format(shareOfTotal),
						entries: countLabel(
							entryCount,
							t("transactions.entriesOne"),
							t("transactions.entriesOther"),
							locale,
						),
					})}
				</p>
			</CardContent>
		</Card>
	);
}
