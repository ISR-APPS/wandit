// The first card of the transaction page, in the kit profile card form: the payee mark, the name and the type,
// a strip of three figures, and the facts of the entry, one per line with an icon.
// TransactionDetailPage renders it at the top of the start column.
import {
	BankIcon,
	CalendarBlankIcon,
	CreditCardIcon,
	HashIcon,
	TagIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	centsToUnits,
	compactMoneyFormat,
	dayFormat,
	daysBetween,
	dayToDate,
	PayeeAvatar,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent } from "~/shared/ui/card";
import type { TransactionRow } from "../api/transactions.queries";
import type { CategoryMonth } from "../lib/transaction-detail";

type EntryProfileCardProps = {
	transaction: TransactionRow;
	/** The total of the category in the month of the entry. null for a transfer or a month the history cuts. */
	categoryMonth: CategoryMonth | null;
};

/** The figure "Days to clear" shows a dash while the bank did not confirm the entry. */
export function EntryProfileCard({
	transaction,
	categoryMonth,
}: EntryProfileCardProps) {
	const { t, locale } = useT();
	const compact = compactMoneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const longDay = dayFormat(locale, "long");
	const figures = [
		{
			label: t("transactions.amount"),
			value: compact.format(centsToUnits(Math.abs(transaction.amountCents))),
		},
		{
			label: t("transactions.monthEntries"),
			value: categoryMonth ? number.format(categoryMonth.entryCount) : "–",
		},
		{
			label: t("transactions.daysToClear"),
			value:
				transaction.clearedDay === null
					? "–"
					: number.format(daysBetween(transaction.day, transaction.clearedDay)),
		},
	];
	const facts = [
		{
			key: "day",
			icon: CalendarBlankIcon,
			text: longDay.format(dayToDate(transaction.day)),
		},
		{ key: "account", icon: BankIcon, text: transaction.accountName },
		{
			key: "method",
			icon: CreditCardIcon,
			text: t(`paymentMethods.${transaction.method}`),
		},
		{ key: "id", icon: HashIcon, text: transaction.id },
		{
			key: "category",
			icon: TagIcon,
			text: t(`categories.${transaction.categoryId}`),
		},
	];

	return (
		<Card>
			<CardContent className="grid gap-12">
				<div className="grid justify-items-center gap-4 text-center">
					<PayeeAvatar
						payee={transaction.payee}
						type={transaction.type}
						categoryId={transaction.categoryId}
						className="size-20 text-2xl [&_svg]:size-8"
					/>
					<div className="grid gap-1">
						<p className="flex flex-wrap items-center justify-center gap-2 font-semibold text-xl">
							<span dir="auto">{transaction.payee}</span>
							<Badge variant="info">
								{t(`transactionTypes.${transaction.type}`)}
							</Badge>
						</p>
						<p className="text-muted-foreground text-sm" dir="auto">
							{transaction.memo}
						</p>
					</div>
				</div>
				<dl className="grid grid-cols-3 divide-x rounded-md border bg-muted text-center rtl:divide-x-reverse">
					{figures.map((figure) => (
						<div key={figure.label} className="grid gap-0.5 px-2 py-3">
							<dt className="text-muted-foreground text-sm">{figure.label}</dt>
							{/* The value shows above its label, as in the kit. The DOM keeps the label first. */}
							<dd className="order-first font-numeric font-semibold text-lg tabular-nums">
								{figure.value}
							</dd>
						</div>
					))}
				</dl>
				<ul className="grid gap-4">
					{facts.map((fact) => (
						<li key={fact.key} className="flex items-center gap-3 text-sm">
							<fact.icon
								aria-hidden="true"
								className="size-4 shrink-0 text-muted-foreground"
							/>
							{fact.key === "account" ? (
								<Link
									to="/app/accounts/$accountId"
									params={{ accountId: transaction.accountId }}
									className="hover:underline"
								>
									{fact.text}
								</Link>
							) : (
								<span className="tabular-nums">{fact.text}</span>
							)}
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
