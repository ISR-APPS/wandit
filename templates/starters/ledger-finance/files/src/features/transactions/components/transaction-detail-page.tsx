// The detail page of one transaction: the slip with the amount and the facts, the route of a transfer,
// the payee history, the status steps, and the place of the entry in its month.
// The /app/transactions/$transactionId route renders it after its loader. An unknown id shows a not-found block.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { fillMessage, TransactionStatusBadge } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { transactionQueryOptions } from "../api/transactions.queries";
import { CategoryMonthCard } from "./category-month-card";
import { PayeeHistoryCard } from "./payee-history-card";
import { StatusTimeline } from "./status-timeline";
import { TransactionSlip } from "./transaction-slip";
import { TransferRouteCard } from "./transfer-route-card";

type TransactionDetailPageProps = {
	/** The `$transactionId` param of the URL: an entry number such as "261113-02". */
	transactionId: string;
};

/** The detail page. A 2/3 main column and a 1/3 rail from the 5xl container width. */
export function TransactionDetailPage({
	transactionId,
}: TransactionDetailPageProps) {
	const { t } = useT();
	const { data: detail } = useSuspenseQuery(
		transactionQueryOptions(transactionId),
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
					{t("transactions.notFound")}
				</p>
			</div>
		);
	}
	const {
		transaction,
		account,
		linked,
		payeeHistory,
		timeline,
		categoryMonth,
	} = detail;

	return (
		<div className="grid gap-6">
			{backLink}
			<PageHeader
				title={transaction.payee}
				description={
					<span className="flex flex-wrap items-center gap-2">
						<TransactionStatusBadge status={transaction.status} />
						<span>{t(`transactionTypes.${transaction.type}`)}</span>
						{/* The category of a transfer is "Transfer" too, so it shows only once. */}
						{transaction.type === "transfer" ? null : (
							<>
								<span aria-hidden="true">·</span>
								<span>{t(`categories.${transaction.categoryId}`)}</span>
							</>
						)}
					</span>
				}
			/>
			<div className="grid @5xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid gap-6">
					<TransactionSlip transaction={transaction} account={account} />
					{linked ? (
						<TransferRouteCard transaction={transaction} linked={linked} />
					) : null}
					<PayeeHistoryCard
						title={fillMessage(
							t(
								transaction.type === "transfer"
									? "transactions.transferHistory"
									: "transactions.payeeHistory",
							),
							{ payee: transaction.payee },
						)}
						rows={payeeHistory}
					/>
				</div>
				<div className="grid gap-6">
					<StatusTimeline steps={timeline} />
					{categoryMonth ? (
						<CategoryMonthCard
							categoryId={transaction.categoryId}
							entryCents={Math.abs(transaction.amountCents)}
							categoryMonth={categoryMonth}
						/>
					) : null}
				</div>
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
				<Skeleton className="h-5 w-48" />
			</div>
			<div className="grid @5xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid gap-6">
					<Skeleton className="h-72" />
					<Skeleton className="h-56" />
				</div>
				<div className="grid gap-6">
					<Skeleton className="h-52" />
					<Skeleton className="h-44" />
				</div>
			</div>
		</div>
	);
}
