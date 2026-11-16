// The home behind login: a line of totals, the balance strip, then the full table of entries.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// It follows the home "ledger" of the app-dashboard skill: the table is the largest block, with no chart panel.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { CUSTOMER_NAME, fillMessage, type PeriodDays } from "~/features/bank";
import {
	transactionsQueryOptions,
	useTransactionColumns,
} from "~/features/transactions";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DataTable } from "~/shared/ui/data-table";
import { ArrowRightIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { overviewKpisQueryOptions } from "../api/overview.queries";
import { BalanceStrip } from "./balance-strip";
import { TotalsLine } from "./totals-line";

/** The period of the strip on the first load, in days. The loader prefetches this period. */
export const DEFAULT_DAYS: PeriodDays = 30;

/** The home page. The period control changes the strip only: the totals keep their 30 days. */
export function OverviewPage() {
	const { t } = useT();
	const { data: kpis } = useSuspenseQuery(overviewKpisQueryOptions());
	const { data: transactions } = useSuspenseQuery(transactionsQueryOptions());
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const { columns, searchText } = useTransactionColumns(transactions);

	return (
		<div className="flex flex-col @3xl/main:gap-6 gap-4">
			<PageHeader
				title={t("overview.title")}
				description={fillMessage(t("overview.description"), {
					customer: CUSTOMER_NAME,
				})}
				actions={
					<Button asChild variant="outline" className="max-md:h-11">
						<Link to="/app/statements">{t("overview.openStatements")}</Link>
					</Button>
				}
			/>
			<TotalsLine
				items={kpis.map(({ labelKey, ...kpi }) => ({
					...kpi,
					label: t(labelKey),
				}))}
			/>
			<BalanceStrip days={days} onDaysChange={setDays} />
			<Card>
				<CardHeader>
					<CardTitle>{t("overview.recentTitle")}</CardTitle>
					<CardDescription>{t("overview.recentDescription")}</CardDescription>
					<CardAction>
						<Button asChild variant="outline" size="sm" className="max-md:h-11">
							<Link to="/app/transactions">
								{t("overview.openList")}
								<ArrowRightIcon className="rtl:rotate-180" />
							</Link>
						</Button>
					</CardAction>
				</CardHeader>
				{/* A smaller side padding on a phone leaves room for the entry and the amount. */}
				<CardContent className="max-md:px-3">
					<DataTable
						rows={transactions}
						columns={columns}
						searchText={searchText}
						noResults={t("transactions.noResults")}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

// Placeholder figures and rows of the skeleton. Fixed keys, because they never reorder.
const SKELETON_TOTALS = ["1", "2", "3", "4"];
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the home loader runs: the totals line, the strip, and 8 table rows. */
export function OverviewPageSkeleton() {
	return (
		<div className="flex flex-col @3xl/main:gap-6 gap-4">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<div className="flex flex-wrap gap-x-6 gap-y-3">
				{SKELETON_TOTALS.map((key) => (
					<Skeleton key={key} className="h-16 @xl/main:w-48 w-full" />
				))}
			</div>
			<Skeleton className="h-28 w-full" />
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-xs" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-11 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the home when the loader fails. Try again runs the loader again. */
export function OverviewPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("overview.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
