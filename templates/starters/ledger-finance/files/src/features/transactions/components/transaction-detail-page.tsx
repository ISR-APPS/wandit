// The detail page of one transaction, in the anatomy of the kit profile page: the title and one primary action,
// the tabs Overview and Payee history, then a 1/3 column (entry card, month card, labels) and a 2/3 column
// (status timeline, then the payee table beside the nearby list).
// The /app/transactions/$transactionId route renders it after its loader. An unknown id shows a not-found block.
import { CopyIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	copyToClipboard,
	dayFormat,
	dayToDate,
	MoneyText,
	TransactionStatusBadge,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { RecordTable } from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	type TransactionRow,
	transactionQueryOptions,
} from "../api/transactions.queries";
import { CategoryMonthCard } from "./category-month-card";
import { EntryLabelsCard } from "./entry-labels-card";
import { EntryProfileCard } from "./entry-profile-card";
import { NearbyEntriesCard } from "./nearby-entries-card";
import { PayeeHistoryCard } from "./payee-history-card";
import { StatusHistoryCard } from "./status-history-card";

type TransactionDetailPageProps = {
	/** The `$transactionId` param of the URL: an entry number such as "261113-02". */
	transactionId: string;
};

/** One column on a phone. From the 5xl container width, the kit split of 1/3 and 2/3. */
export function TransactionDetailPage({
	transactionId,
}: TransactionDetailPageProps) {
	const { t, locale } = useT();
	const { data: detail } = useSuspenseQuery(
		transactionQueryOptions(transactionId),
	);
	const day = dayFormat(locale, "long");

	if (!detail) {
		return (
			<div className="grid gap-4">
				<PageHeader title={t("transactions.title")} />
				<p className="text-muted-foreground text-sm">
					{t("transactions.notFound")}
				</p>
				<Button asChild variant="outline" className="justify-self-start">
					<Link to="/app/transactions">{t("transactions.openList")}</Link>
				</Button>
			</div>
		);
	}
	const { transaction, payeeHistory, nearby, timeline, categoryMonth } = detail;

	return (
		<div className="grid gap-4">
			<PageHeader
				title={transaction.payee}
				actions={
					<Button
						type="button"
						onClick={() =>
							copyToClipboard(transaction.id, {
								done: t("table.copied"),
								failed: t("table.copyFailed"),
							})
						}
					>
						<CopyIcon />
						{t("transactions.copyNumber")}
					</Button>
				}
			/>
			<Tabs defaultValue="overview" className="gap-4">
				<TabsList>
					<TabsTrigger value="overview">
						{t("transactions.overview")}
					</TabsTrigger>
					<TabsTrigger value="history">
						{t("transactions.historyTab")}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="overview">
					<div className="grid @5xl/main:grid-cols-3 items-start gap-4">
						<div className="grid gap-4">
							<EntryProfileCard
								transaction={transaction}
								categoryMonth={categoryMonth}
							/>
							<CategoryMonthCard
								transaction={transaction}
								categoryMonth={categoryMonth}
							/>
							<EntryLabelsCard transaction={transaction} />
						</div>
						<div className="@5xl/main:col-span-2 grid gap-4">
							<StatusHistoryCard
								transaction={transaction}
								timeline={timeline}
							/>
							<div className="grid @3xl/main:grid-cols-2 items-start gap-4">
								<PayeeHistoryCard
									payee={transaction.payee}
									rows={payeeHistory}
								/>
								<NearbyEntriesCard day={transaction.day} rows={nearby} />
							</div>
						</div>
					</div>
				</TabsContent>
				<TabsContent value="history">
					<Card>
						<CardContent>
							<RecordTable<TransactionRow>
								rows={payeeHistory}
								columns={[
									{
										id: "day",
										header: t("transactions.date"),
										cell: (row) => (
											<span className="whitespace-nowrap tabular-nums">
												{day.format(dayToDate(row.day))}
											</span>
										),
										sortValue: (row) => row.day,
									},
									{
										id: "memo",
										header: t("transactions.memo"),
										cell: (row) => (
											<Link
												to="/app/transactions/$transactionId"
												params={{ transactionId: row.id }}
												className="font-medium hover:underline"
												dir="auto"
											>
												{row.memo}
											</Link>
										),
									},
									{
										id: "account",
										header: t("transactions.account"),
										cell: (row) => row.accountName,
										hideable: true,
									},
									{
										id: "status",
										header: t("transactions.status"),
										cell: (row) => (
											<TransactionStatusBadge status={row.status} />
										),
										hideable: true,
									},
									{
										id: "amount",
										header: t("transactions.amount"),
										cell: (row) => (
											<MoneyText amountCents={row.amountCents} sign="always" />
										),
										sortValue: (row) => row.amountCents,
										align: "end",
									},
								]}
								searchText={(row) => row.memo}
								searchPlaceholder={t("transactions.filterNotes")}
								pageSize={20}
								noResults={t("transactions.payeeHistoryEmpty")}
							/>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function TransactionDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-9 w-40" />
			</div>
			<Skeleton className="h-9 w-56" />
			<div className="grid @5xl/main:grid-cols-3 gap-4">
				<div className="grid gap-4">
					<Skeleton className="h-112" />
					<Skeleton className="h-28" />
				</div>
				<div className="@5xl/main:col-span-2 grid gap-4">
					<Skeleton className="h-96" />
					<Skeleton className="h-72" />
				</div>
			</div>
		</div>
	);
}
