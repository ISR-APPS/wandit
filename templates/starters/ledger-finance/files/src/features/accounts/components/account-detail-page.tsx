// The detail page of one account: the balance as the headline, the balance chart, the entries of the account,
// and a rail with the facts and the flow of the last 30 days.
// The /app/accounts/$accountId route renders it after its loader. An unknown id shows a not-found block.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { MoneyText, type PeriodDays } from "~/features/ledger";
import { useTransactionTable } from "~/features/transactions";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DataTable } from "~/shared/ui/data-table";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { accountQueryOptions } from "../api/accounts.queries";
import { AccountFactsCard } from "./account-facts-card";
import { AccountFlowCard } from "./account-flow-card";
import { BalanceChartCard } from "./balance-chart-card";

/** The period of the balance chart on the first load, in days. The loader prefetches this period. */
export const DEFAULT_BALANCE_DAYS: PeriodDays = 30;

type AccountDetailPageProps = {
	/** The `$accountId` param of the URL, for example "operating". */
	accountId: string;
};

/** The detail page. A 2/3 main column and a 1/3 rail from the 5xl container width. */
export function AccountDetailPage({ accountId }: AccountDetailPageProps) {
	const { t } = useT();
	const { data: detail } = useSuspenseQuery(accountQueryOptions(accountId));
	const [days, setDays] = useState<PeriodDays>(DEFAULT_BALANCE_DAYS);
	// Every row is on this account, so the small line under the category shows the payment method.
	const table = useTransactionTable(detail?.transactions ?? [], "method");

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start max-md:h-11"
		>
			<Link to="/app/accounts">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("accounts.title")}
			</Link>
		</Button>
	);
	if (!detail) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">
					{t("accounts.notFound")}
				</p>
			</div>
		);
	}
	const { account, transactions, topCategories } = detail;
	const isCard = account.type === "credit_card";

	return (
		<div className="grid grid-cols-1 gap-6">
			{backLink}
			<PageHeader
				title={account.name}
				description={
					<span className="flex flex-wrap items-center gap-2">
						<Badge variant="secondary">
							{t(`accountTypes.${account.type}`)}
						</Badge>
						{account.institution ? (
							<span>
								<bdi>{account.institution}</bdi>
								<span className="tabular-nums">{` •••• ${account.numberEnding ?? ""}`}</span>
							</span>
						) : null}
					</span>
				}
				actions={
					// The block wraps under the title on a phone, so it aligns to the start there and to the end beside the title.
					<div className="grid gap-0.5 text-start @md/main:text-end">
						<p className="text-muted-foreground text-xs">
							{t(isCard ? "accounts.owed" : "accounts.balance")}
						</p>
						<MoneyText
							amountCents={Math.abs(account.balanceCents)}
							className="font-medium text-2xl"
						/>
					</div>
				}
			/>
			<div className="grid @5xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid grid-cols-1 gap-6">
					<BalanceChartCard
						accountId={account.id}
						accountName={account.name}
						isDebt={isCard}
						days={days}
						onDaysChange={setDays}
					/>
					<Card>
						<CardHeader>
							<CardTitle>{t("transactions.title")}</CardTitle>
							<CardDescription>
								{t("accounts.entriesDescription")}
							</CardDescription>
						</CardHeader>
						{/* A smaller side padding on a phone leaves room for the date, the payee, and the amount. */}
						<CardContent className="max-md:px-3">
							<DataTable
								rows={transactions}
								columns={table.columns}
								searchText={table.searchText}
								noResults={t("transactions.noResults")}
							/>
						</CardContent>
					</Card>
				</div>
				<div className="grid grid-cols-1 gap-6">
					<AccountFactsCard account={account} />
					<AccountFlowCard account={account} topCategories={topCategories} />
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function AccountDetailPageSkeleton() {
	return (
		<div className="grid grid-cols-1 gap-6">
			<Skeleton className="h-8 w-28" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-56 max-w-full" />
				<Skeleton className="h-5 w-48" />
			</div>
			<div className="grid @5xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid gap-6">
					<Skeleton className="h-80" />
					<Skeleton className="h-96" />
				</div>
				<div className="grid gap-6">
					<Skeleton className="h-56" />
					<Skeleton className="h-64" />
				</div>
			</div>
		</div>
	);
}
