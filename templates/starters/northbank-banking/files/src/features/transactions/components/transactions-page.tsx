// The transactions page: the period and the export in the header, Latest | Upcoming tabs,
// and one card of entry rows with pages under it. It follows the kit payment transactions page.
// The /app/transactions route renders it and owns the tab through the URL. The page holds the period and the page number.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	CUSTOMER_NAME,
	daysBetween,
	downloadCsv,
	EntryRows,
	fillMessage,
	type PeriodDays,
	PeriodSelect,
	toCsv,
	todayIsoDay,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { transactionsQueryOptions } from "../api/transactions.queries";
import { transactionCsvColumns } from "../lib/transaction-csv";
import { ENTRY_TABS, type EntryTab } from "../lib/transactions-search";

// Rows per page of the list.
const PAGE_SIZE = 20;

type TransactionsPageProps = {
	/** The tab of the URL. */
	tab: EntryTab;
	/** Writes the new tab into the URL. */
	onTabChange: (tab: EntryTab) => void;
};

/** The period filters the Latest tab. Upcoming lists every pending entry: they all fall in the last few days. */
export function TransactionsPage({ tab, onTabChange }: TransactionsPageProps) {
	const { t, locale } = useT();
	const { data: rows } = useSuspenseQuery(transactionsQueryOptions());
	const [days, setDays] = useState<PeriodDays>(30);
	const [page, setPage] = useState(1);
	const today = todayIsoDay();
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const number = new Intl.NumberFormat(locale);
	const shown =
		tab === "upcoming"
			? rows.filter((row) => row.status === "pending").reverse()
			: rows.filter(
					(row) =>
						row.status !== "pending" && daysBetween(row.day, today) < days,
				);
	const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
	// A shorter period can leave fewer pages than the current one, so clamp here.
	const currentPage = Math.min(page, pageCount);
	const firstIndex = (currentPage - 1) * PAGE_SIZE;
	const pageRows = shown.slice(firstIndex, firstIndex + PAGE_SIZE);

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("transactions.title")}
				description={fillMessage(t("transactions.description"), {
					customer: CUSTOMER_NAME,
				})}
				actions={
					<>
						<PeriodSelect
							days={days}
							onDaysChange={(next) => {
								setDays(next);
								setPage(1);
							}}
						/>
						<Button
							type="button"
							size="icon"
							aria-label={t("common.exportCsv")}
							onClick={() =>
								downloadCsv(
									`northbank-${tab}-${days}d.csv`,
									toCsv(shown, transactionCsvColumns(t)),
								)
							}
						>
							<DownloadSimpleIcon />
						</Button>
					</>
				}
			/>
			<Tabs
				value={tab}
				onValueChange={(value) => {
					onTabChange(ENTRY_TABS.find((item) => item === value) ?? "latest");
					setPage(1);
				}}
			>
				<TabsList>
					<TabsTrigger value="latest">{t("entries.latest")}</TabsTrigger>
					<TabsTrigger value="upcoming">{t("entries.upcoming")}</TabsTrigger>
				</TabsList>
			</Tabs>
			<Card className="overflow-hidden py-0">
				<EntryRows
					rows={pageRows}
					emptyText={
						tab === "upcoming"
							? t("entries.emptyUpcoming")
							: fillMessage(t("entries.emptyPeriod"), {
									period: dayCount.format(days),
								})
					}
				/>
			</Card>
			{shown.length > PAGE_SIZE ? (
				<div className="flex items-center gap-2">
					<p className="flex-1 text-muted-foreground text-sm tabular-nums">
						{fillMessage(t("table.range"), {
							from: number.format(firstIndex + 1),
							to: number.format(firstIndex + pageRows.length),
							count: number.format(shown.length),
						})}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={currentPage === 1}
						onClick={() => setPage(currentPage - 1)}
					>
						{t("table.previous")}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={currentPage === pageCount}
						onClick={() => setPage(currentPage + 1)}
					>
						{t("table.next")}
					</Button>
				</div>
			) : null}
		</div>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function TransactionsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-4 w-80 max-w-full" />
				</div>
				<Skeleton className="h-9 w-56 max-w-full" />
			</div>
			<Skeleton className="h-9 w-48" />
			<Skeleton className="h-160" />
		</div>
	);
}

/** Error state when a loader of the transactions pages fails. Try again runs the loader again. */
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
