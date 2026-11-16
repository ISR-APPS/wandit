// The detail page of one entry: the amount and the facts, a rail with the status timeline
// and the card, payee, or transfer link, and the other entries with the same party.
// The /app/transactions/$transactionId route renders it after its loader.
// An unknown id shows a not-found block with a link back to the list.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	accountOf,
	dayFormat,
	dayToDate,
	directionOf,
	fillMessage,
	findCard,
	findPayee,
	MoneyText,
	TransactionStatusBadge,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { transactionDetailQueryOptions } from "../api/transactions.queries";
import { HistoryTable } from "./history-table";
import { StatusTimeline } from "./status-timeline";

type TransactionDetailPageProps = {
	/** The `$transactionId` param of the URL. An unknown id shows the not-found block. */
	transactionId: string;
};

/**
 * From the 4xl container width: the facts in 2/3 beside the status in a 1/3 rail, both of one height.
 * The history table takes the full width under them.
 */
export function TransactionDetailPage({
	transactionId,
}: TransactionDetailPageProps) {
	const { t, locale } = useT();
	const { data: detail } = useSuspenseQuery(
		transactionDetailQueryOptions(transactionId),
	);

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start max-md:h-11"
		>
			<Link to="/app/transactions">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("transactions.title")}
			</Link>
		</Button>
	);
	if (!detail) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">
					{t("transactionDetail.notFound")}
				</p>
			</div>
		);
	}

	const { transaction, linked, history, historyCount, steps } = detail;
	const number = new Intl.NumberFormat(locale);
	const longDay = dayFormat(locale, "long");
	const shortDay = dayFormat(locale);
	const account = accountOf(transaction.accountId);
	const card = transaction.cardId ? findCard(transaction.cardId) : undefined;
	const payee = transaction.payeeId
		? findPayee(transaction.payeeId)
		: undefined;
	const direction = directionOf(transaction);

	type Fact = { id: string; label: string; value: ReactNode };
	const facts: Fact[] = [
		{
			id: "day",
			label: t("transactions.date"),
			value: longDay.format(dayToDate(transaction.day)),
		},
		{
			id: "account",
			label: t("transactions.account"),
			value: `${t(`accounts.${account.id}`)} ••${account.numberEnding}`,
		},
		{
			id: "method",
			label: t("transactionDetail.method"),
			value: t(`methods.${transaction.method}`),
		},
		{
			id: "category",
			label: t("transactionDetail.category"),
			value: t(`categories.${transaction.category}`),
		},
		// The memo of a card payment is "Card ending 4417". The card link in the rail says the same, with the holder.
		...(card
			? []
			: [
					{
						id: "memo",
						label: t("transactionDetail.memo"),
						value: <bdi>{transaction.memo}</bdi>,
					},
				]),
		{
			id: "reference",
			label: t("transactionDetail.reference"),
			value: <span className="tabular-nums">{transaction.reference}</span>,
		},
	];
	// The other party of the entry: one card, one payee, or the other account of a transfer.
	const parties: Fact[] = [];
	if (card) {
		parties.push({
			id: "card",
			label: t("transactionDetail.card"),
			value: (
				<Link
					to="/app/cards/$cardId"
					params={{ cardId: card.id }}
					className="underline-offset-4 hover:underline"
				>
					{`${card.holderName} ••${card.numberEnding}`}
				</Link>
			),
		});
	}
	if (payee) {
		parties.push({
			id: "payee",
			label: t("transactionDetail.payee"),
			value: (
				<Link
					to="/app/payees/$payeeId"
					params={{ payeeId: payee.id }}
					className="underline-offset-4 hover:underline"
				>
					{payee.name}
				</Link>
			),
		});
	}
	if (linked) {
		const linkedAccount = accountOf(linked.accountId);
		parties.push({
			id: "linked",
			label: t("transactionDetail.otherSide"),
			value: (
				<Link
					to="/app/transactions/$transactionId"
					params={{ transactionId: linked.id }}
					className="underline-offset-4 hover:underline"
				>
					{`${t(`accounts.${linkedAccount.id}`)} ••${linkedAccount.numberEnding}`}
				</Link>
			),
		});
	}

	return (
		<div className="grid gap-6">
			{backLink}
			<PageHeader
				title={transaction.counterparty}
				description={
					<span className="flex flex-wrap items-center gap-2">
						<TransactionStatusBadge status={transaction.status} />
						<span>{t(`transactions.directions.${direction}`)}</span>
					</span>
				}
			/>
			<div className="grid @4xl/main:grid-cols-3 gap-6">
				<Card className="@4xl/main:col-span-2">
					<CardContent className="grid gap-6">
						<div className="grid gap-1">
							<span className="label-text text-muted-foreground text-sm">
								{t("transactions.amount")}
							</span>
							<MoneyText
								amountCents={transaction.amountCents}
								isSigned
								className="font-medium text-4xl"
							/>
							{transaction.status === "returned" ? (
								<p className="text-destructive text-sm">
									{t("transactionDetail.returnedNote")}
								</p>
							) : null}
						</div>
						<dl className="grid @xl/main:grid-cols-2 gap-x-8 gap-y-4 border-t pt-6 text-sm">
							{facts.map((fact) => (
								// content-start: a value that wraps makes its row taller, and the short value beside it stays under its label.
								<div key={fact.id} className="grid content-start gap-1">
									<dt className="text-muted-foreground">{fact.label}</dt>
									<dd>{fact.value}</dd>
								</div>
							))}
						</dl>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>{t("transactionDetail.status")}</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-6">
						<StatusTimeline steps={steps} />
						{parties.length > 0 ? (
							<dl className="grid gap-4 border-t pt-5 text-sm">
								{parties.map((party) => (
									<div key={party.id} className="grid gap-1">
										<dt className="text-muted-foreground">{party.label}</dt>
										<dd className="font-medium">{party.value}</dd>
									</div>
								))}
							</dl>
						) : null}
					</CardContent>
				</Card>
				<Card className="@4xl/main:col-span-3">
					<CardHeader>
						<CardTitle>{t("transactionDetail.history")}</CardTitle>
						<CardDescription>
							{/* More entries than the list shows: the count is above 8, so the noun is always plural. */}
							{historyCount > history.length
								? fillMessage(t("transactionDetail.historyNewest"), {
										shown: number.format(history.length),
										count: number.format(historyCount),
									})
								: t("transactionDetail.historyAll")}
						</CardDescription>
					</CardHeader>
					<CardContent className="max-md:px-3">
						{history.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								{t("transactionDetail.noHistory")}
							</p>
						) : (
							<HistoryTable rows={history} shortDay={shortDay} />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function TransactionDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-32" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-64 max-w-full" />
				<Skeleton className="h-5 w-40" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 items-start gap-6">
				<Skeleton className="@4xl/main:col-span-2 h-80" />
				<Skeleton className="h-48" />
			</div>
		</div>
	);
}
