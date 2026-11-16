// The list of every entry of the three accounts: direction tabs, an account filter, search, sort, and pages.
// The /app/transactions route renders it after its loader. The route also uses the skeleton and the error below.
// The tabs count the rows of the chosen account, so each count equals the rows that its tab shows.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	ACCOUNT_IDS,
	type AccountId,
	accountOf,
	CUSTOMER_NAME,
	directionOf,
	FilterTabs,
	fillMessage,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { transactionsQueryOptions } from "../api/transactions.queries";
import { useTransactionColumns } from "../hooks/use-transaction-columns";

// The tabs of the page, in order. "all" shows every direction.
const DIRECTION_TABS = ["all", "in", "out", "transfer"] as const;

type DirectionTab = (typeof DIRECTION_TABS)[number];

/** The list page. The account filter applies first, then the tab, then the search of DataTable. */
export function TransactionsPage() {
	const { t } = useT();
	const { data: transactions } = useSuspenseQuery(transactionsQueryOptions());
	const [direction, setDirection] = useState<DirectionTab>("all");
	const [accountId, setAccountId] = useState<AccountId | "all">("all");

	const accountRows =
		accountId === "all"
			? transactions
			: transactions.filter((row) => row.accountId === accountId);
	const countOf = (tab: DirectionTab) =>
		tab === "all"
			? accountRows.length
			: accountRows.filter((row) => directionOf(row) === tab).length;
	const rows =
		direction === "all"
			? accountRows
			: accountRows.filter((row) => directionOf(row) === direction);
	const { columns, searchText } = useTransactionColumns(rows);

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("transactions.title")}
				description={fillMessage(t("transactions.pageDescription"), {
					customer: CUSTOMER_NAME,
				})}
			/>
			<Card>
				<CardContent className="max-md:px-3">
					<DataTable
						rows={rows}
						columns={columns}
						searchText={searchText}
						noResults={t("transactions.noResults")}
						toolbar={
							<div className="flex min-w-0 flex-wrap items-center gap-2">
								<FilterTabs
									value={direction}
									options={DIRECTION_TABS.map((tab) => ({
										value: tab,
										label: t(`transactions.directions.${tab}`),
										count: countOf(tab),
									}))}
									onValueChange={setDirection}
									label={t("transactions.direction")}
								/>
								<Select
									value={accountId}
									onValueChange={(value) =>
										setAccountId(
											ACCOUNT_IDS.find((option) => option === value) ?? "all",
										)
									}
								>
									<SelectTrigger
										aria-label={t("transactions.account")}
										className="w-auto min-w-44 max-md:h-11"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">
											{t("transactions.allAccounts")}
										</SelectItem>
										{ACCOUNT_IDS.map((id) => (
											<SelectItem key={id} value={id}>
												{`${t(`accounts.${id}`)} ••${accountOf(id).numberEnding}`}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function TransactionsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-4 w-72 max-w-full" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-md" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-11 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the entry pages when a loader fails. Try again runs the loader again. */
export function TransactionsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("transactions.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
