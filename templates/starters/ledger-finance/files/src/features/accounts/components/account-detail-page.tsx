// The detail page of one account, in the anatomy of the kit profile page: the title and one primary action,
// the tabs Overview and Entries, then a 1/3 column (profile card, usage card, categories) and a 2/3 column
// (activity timeline, then the history table beside the other accounts).
// The /app/accounts/$accountId route renders it after its loader. An unknown id shows a not-found block.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	dayFormat,
	dayToDate,
	downloadCsv,
	MoneyText,
	TransactionStatusBadge,
	toCsv,
} from "~/features/ledger";
import {
	type TransactionRow,
	transactionCsvColumns,
} from "~/features/transactions";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { RecordTable } from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { accountQueryOptions } from "../api/accounts.queries";
import { AccountActivityCard } from "./account-activity-card";
import { AccountCategoriesCard } from "./account-categories-card";
import { AccountHistoryCard } from "./account-history-card";
import { AccountProfileCard } from "./account-profile-card";
import { AccountUsageCard } from "./account-usage-card";
import { OtherAccountsCard } from "./other-accounts-card";

type AccountDetailPageProps = {
	/** The `$accountId` param of the URL, for example "operating". */
	accountId: string;
};

/** The tab is page state: "View all" of the activity card opens the Entries tab. */
export function AccountDetailPage({ accountId }: AccountDetailPageProps) {
	const { t, locale } = useT();
	const { data: detail } = useSuspenseQuery(accountQueryOptions(accountId));
	const [tab, setTab] = useState("overview");
	const day = dayFormat(locale, "long");

	if (!detail) {
		return (
			<div className="grid gap-4">
				<PageHeader title={t("accounts.title")} />
				<p className="text-muted-foreground text-sm">
					{t("accounts.notFound")}
				</p>
				<Button asChild variant="outline" className="justify-self-start">
					<Link to="/app/accounts">{t("accounts.openList")}</Link>
				</Button>
			</div>
		);
	}
	const { account, transactions } = detail;

	return (
		<div className="grid gap-4">
			<PageHeader
				title={account.name}
				actions={
					<Button
						type="button"
						onClick={() =>
							downloadCsv(
								`account-${account.id}.csv`,
								toCsv(transactions, transactionCsvColumns(t)),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("accounts.exportEntries")}
					</Button>
				}
			/>
			<Tabs value={tab} onValueChange={setTab} className="gap-4">
				<TabsList>
					<TabsTrigger value="overview">{t("accounts.overview")}</TabsTrigger>
					<TabsTrigger value="entries">{t("accounts.entries")}</TabsTrigger>
				</TabsList>
				<TabsContent value="overview">
					<div className="grid @5xl/main:grid-cols-3 items-start gap-4">
						<div className="grid gap-4">
							<AccountProfileCard account={account} />
							<AccountUsageCard
								account={account}
								cashOnHandCents={detail.cashOnHandCents}
							/>
							<AccountCategoriesCard categories={detail.topCategories} />
						</div>
						<div className="@5xl/main:col-span-2 grid gap-4">
							<AccountActivityCard
								rows={transactions}
								onViewAll={() => setTab("entries")}
							/>
							<div className="grid @3xl/main:grid-cols-2 items-start gap-4">
								<AccountHistoryCard rows={transactions} />
								<OtherAccountsCard accounts={detail.otherAccounts} />
							</div>
						</div>
					</div>
				</TabsContent>
				<TabsContent value="entries">
					<Card>
						<CardContent>
							<RecordTable<TransactionRow>
								rows={transactions}
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
										id: "payee",
										header: t("transactions.payee"),
										cell: (row) => (
											<Link
												to="/app/transactions/$transactionId"
												params={{ transactionId: row.id }}
												className="grid hover:underline"
											>
												<span className="font-medium" dir="auto">
													{row.payee}
												</span>
												<span
													className="text-muted-foreground text-xs"
													dir="auto"
												>
													{row.memo}
												</span>
											</Link>
										),
										sortValue: (row) => row.payee,
									},
									{
										id: "category",
										header: t("transactions.category"),
										cell: (row) => t(`categories.${row.categoryId}`),
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
								searchText={(row) => `${row.payee} ${row.memo}`}
								searchPlaceholder={t("accounts.filterEntries")}
								pageSize={20}
								noResults={t("transactions.noResults")}
							/>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function AccountDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-9 w-40" />
			</div>
			<Skeleton className="h-9 w-48" />
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
