// The main card of the transaction detail page: the amount as the headline, then the facts of the entry.
// TransactionDetailPage renders it at the top of the main column.
// The account fact links to the detail page of that account.
import { Link } from "@tanstack/react-router";
import {
	type Account,
	dayFormat,
	dayToDate,
	MoneyText,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";
import type { TransactionRow } from "../api/transactions.queries";

type TransactionSlipProps = {
	transaction: TransactionRow;
	/** The account that holds the entry. */
	account: Account;
};

/**
 * Income shows a plus sign in green. An expense and a transfer keep the text color.
 * A transfer shows its amount with no sign and no category fact: the route card gives the direction.
 */
export function TransactionSlip({
	transaction,
	account,
}: TransactionSlipProps) {
	const { t, locale } = useT();
	const day = dayFormat(locale, "long");
	const weekday = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		timeZone: "UTC",
	});
	const date = dayToDate(transaction.day);
	const isTransfer = transaction.type === "transfer";

	return (
		<Card className="gap-0 overflow-hidden py-0">
			<CardContent className="grid gap-1 py-6">
				<p className="label-text text-muted-foreground text-sm">
					{t(`transactions.amountOf.${transaction.type}`)}
				</p>
				<MoneyText
					amountCents={
						isTransfer
							? Math.abs(transaction.amountCents)
							: transaction.amountCents
					}
					sign={transaction.type === "income" ? "always" : "auto"}
					className={cn(
						"justify-self-start font-medium text-4xl",
						transaction.type === "income" && "text-success",
					)}
				/>
				<p className="text-muted-foreground text-sm" dir="auto">
					{transaction.memo}
				</p>
			</CardContent>
			<CardContent className="border-t py-5">
				<dl className="grid @3xl/main:grid-cols-3 grid-cols-2 gap-x-6 gap-y-5 text-sm">
					<div className="grid gap-1">
						<dt className="text-muted-foreground">{t("transactions.date")}</dt>
						<dd>
							{day.format(date)}
							<span className="text-muted-foreground">{` · ${weekday.format(date)}`}</span>
						</dd>
					</div>
					<div className="grid gap-1">
						<dt className="text-muted-foreground">
							{t("transactions.account")}
						</dt>
						<dd>
							<Link
								to="/app/accounts/$accountId"
								params={{ accountId: account.id }}
								className="font-medium underline-offset-4 hover:underline"
							>
								<bdi>{account.name}</bdi>
							</Link>
							{account.numberEnding ? (
								<span className="text-muted-foreground tabular-nums">
									{` •••• ${account.numberEnding}`}
								</span>
							) : null}
						</dd>
					</div>
					{/* The category of a transfer is "Transfer", the same as its type. */}
					{isTransfer ? null : (
						<div className="grid gap-1">
							<dt className="text-muted-foreground">
								{t("transactions.category")}
							</dt>
							<dd>{t(`categories.${transaction.categoryId}`)}</dd>
						</div>
					)}
					<div className="grid gap-1">
						<dt className="text-muted-foreground">
							{t("transactions.method")}
						</dt>
						<dd>{t(`paymentMethods.${transaction.method}`)}</dd>
					</div>
					<div className="grid gap-1">
						<dt className="text-muted-foreground">{t("transactions.type")}</dt>
						<dd>{t(`transactionTypes.${transaction.type}`)}</dd>
					</div>
					<div className="grid gap-1">
						<dt className="text-muted-foreground">
							{t("transactions.entryNumber")}
						</dt>
						<dd className="font-numeric tabular-nums">{transaction.id}</dd>
					</div>
				</dl>
			</CardContent>
		</Card>
	);
}
