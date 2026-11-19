// The transactions page behind login, in the anatomy of the kit transactions page: the header with the period
// and the export, the tabs Latest and Upcoming, then one card of rows (day, payee and status, amount, open button).
// The /app/transactions route renders it after its loader. `?type=` and `?category=` filter both tabs.
import { DownloadSimpleIcon, XIcon } from "@phosphor-icons/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	addDays,
	type CategoryId,
	dayCountFormat,
	dayFormat,
	dayToDate,
	downloadCsv,
	fillMessage,
	MoneyText,
	type PeriodDays,
	PeriodSelect,
	type ScheduledEntry,
	type TransactionType,
	toCsv,
	toIsoDay,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "~/shared/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	scheduledQueryOptions,
	type TransactionRow,
	transactionsQueryOptions,
} from "../api/transactions.queries";
import { transactionCsvColumns } from "../lib/transaction-csv";
import type { TransactionsSearch } from "../lib/transactions-search";

/** The period that the page shows first, in days. */
const DEFAULT_DAYS: PeriodDays = 30;

// Rows per page of the Latest tab: one screen at 1440 x 900 under the header and the tabs.
const PAGE_SIZE = 12;

// The amount color of each type: money in is good news, money out is bad news, a transfer only moves money.
const AMOUNT_TINTS = {
	income: "text-success",
	expense: "text-destructive",
	transfer: "text-foreground",
} satisfies Record<TransactionType, string>;

type TransactionsPageProps = {
	/** The filters from the URL. An absent key shows every type or every category. */
	search: TransactionsSearch;
};

/** The period filters the Latest tab. The Upcoming tab always shows the next 30 days. */
export function TransactionsPage({ search }: TransactionsPageProps) {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const [page, setPage] = useState(1);
	const { data: rows } = useSuspenseQuery(transactionsQueryOptions());
	const scheduled = useQuery(scheduledQueryOptions());
	const dayCount = dayCountFormat(locale);
	const longDay = dayFormat(locale, "long");
	const number = new Intl.NumberFormat(locale);
	const periodStart = addDays(toIsoDay(Date.now()), 1 - days);
	const matchesFilters = (row: {
		type: TransactionType;
		categoryId: CategoryId;
	}) =>
		(!search.type || row.type === search.type) &&
		(!search.category || row.categoryId === search.category);
	// `YYYY-MM-DD` texts compare in date order.
	const latest = rows.filter(
		(row) => row.day >= periodStart && matchesFilters(row),
	);
	const upcoming = (scheduled.data ?? []).filter(matchesFilters);
	const pageCount = Math.max(1, Math.ceil(latest.length / PAGE_SIZE));
	// A period change can shrink the list below the current page, so clamp here.
	const currentPage = Math.min(page, pageCount);
	const firstIndex = (currentPage - 1) * PAGE_SIZE;
	const pageRows = latest.slice(firstIndex, firstIndex + PAGE_SIZE);
	const hasFilters = search.type !== undefined || search.category !== undefined;

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("transactions.title")}
				description={fillMessage(t("period.last"), {
					period: dayCount.format(days),
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
							aria-label={t("transactions.exportPeriod")}
							onClick={() =>
								downloadCsv(
									"transactions.csv",
									toCsv(latest, transactionCsvColumns(t)),
								)
							}
						>
							<DownloadSimpleIcon />
						</Button>
					</>
				}
			/>
			{/* min-w-0 lets the table scroll inside its card on a phone, not the whole page. */}
			<Tabs defaultValue="latest" className="min-w-0">
				<div className="mb-2 flex flex-wrap items-center gap-2">
					<TabsList>
						<TabsTrigger value="latest">{t("transactions.latest")}</TabsTrigger>
						<TabsTrigger value="upcoming">
							{t("transactions.upcoming")}
						</TabsTrigger>
					</TabsList>
					{search.type ? (
						<Badge variant="secondary">
							{t(`transactions.tabs.${search.type}`)}
						</Badge>
					) : null}
					{search.category ? (
						<Badge variant="secondary">
							{t(`categories.${search.category}`)}
						</Badge>
					) : null}
					{hasFilters ? (
						<Button asChild variant="ghost" size="sm">
							<Link to="/app/transactions">
								<XIcon />
								{t("transactions.clearFilters")}
							</Link>
						</Button>
					) : null}
				</div>
				<Card className="gap-0 overflow-hidden py-0">
					<TabsContent value="latest">
						{pageRows.length === 0 ? (
							<p className="px-6 py-10 text-center text-muted-foreground text-sm">
								{t("transactions.noResults")}
							</p>
						) : (
							<Table>
								<TableBody>
									{pageRows.map((row) => (
										<LatestRow key={row.id} row={row} dayText={longDay} />
									))}
								</TableBody>
							</Table>
						)}
						<div className="flex items-center gap-2 border-t px-6 py-3">
							<p className="flex-1 text-muted-foreground text-sm tabular-nums">
								{fillMessage(t("table.range"), {
									from: number.format(
										pageRows.length === 0 ? 0 : firstIndex + 1,
									),
									to: number.format(firstIndex + pageRows.length),
									count: number.format(latest.length),
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
					</TabsContent>
					<TabsContent value="upcoming">
						{scheduled.isError ? (
							<div className="grid justify-items-center gap-3 px-6 py-10 text-center">
								<p className="text-sm" role="alert">
									{t("transactions.upcomingError")}
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => scheduled.refetch()}
								>
									{t("common.retry")}
								</Button>
							</div>
						) : scheduled.isPending ? (
							<div className="grid gap-3 p-6">
								<Skeleton className="h-12 w-full" />
								<Skeleton className="h-12 w-full" />
								<Skeleton className="h-12 w-full" />
							</div>
						) : upcoming.length === 0 ? (
							<p className="px-6 py-10 text-center text-muted-foreground text-sm">
								{t("transactions.upcomingEmpty")}
							</p>
						) : (
							<Table>
								<TableBody>
									{upcoming.map((entry) => (
										<UpcomingRow
											key={`${entry.day}-${entry.payee}-${entry.memo}`}
											entry={entry}
											dayText={longDay}
										/>
									))}
								</TableBody>
							</Table>
						)}
					</TabsContent>
				</Card>
			</Tabs>
		</div>
	);
}

type LatestRowProps = {
	row: TransactionRow;
	/** The formatter of the day cell, made once by the page. */
	dayText: Intl.DateTimeFormat;
};

// One booked entry: the day, the payee over its status and category, the amount, and the open button.
function LatestRow({ row, dayText }: LatestRowProps) {
	const { t } = useT();
	return (
		<TableRow>
			<TableCell className="w-36 whitespace-nowrap ps-6 tabular-nums">
				{dayText.format(dayToDate(row.day))}
			</TableCell>
			<TableCell>
				<div className="grid gap-0.5">
					<span className="font-medium text-foreground" dir="auto">
						{row.payee}
					</span>
					<span className="text-muted-foreground text-sm">
						{`${t(`transactionStatuses.${row.status}`)} · ${t(`categories.${row.categoryId}`)}`}
					</span>
				</div>
			</TableCell>
			<TableCell className="pe-6">
				<div className="flex items-center justify-end gap-4">
					<MoneyText
						amountCents={row.amountCents}
						sign="always"
						className={cn("text-sm", AMOUNT_TINTS[row.type])}
					/>
					<Button
						asChild
						variant="outline"
						size="sm"
						aria-label={fillMessage(t("transactions.openEntry"), {
							payee: row.payee,
						})}
					>
						<Link
							to="/app/transactions/$transactionId"
							params={{ transactionId: row.id }}
						>
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</div>
			</TableCell>
		</TableRow>
	);
}

type UpcomingRowProps = {
	entry: ScheduledEntry;
	/** The formatter of the day cell, made once by the page. */
	dayText: Intl.DateTimeFormat;
};

// One scheduled entry. It has no page yet, so the row has no open button.
function UpcomingRow({ entry, dayText }: UpcomingRowProps) {
	const { t } = useT();
	return (
		<TableRow>
			<TableCell className="w-36 whitespace-nowrap ps-6 tabular-nums">
				{dayText.format(dayToDate(entry.day))}
			</TableCell>
			<TableCell>
				<div className="grid gap-0.5">
					<span className="font-medium text-foreground" dir="auto">
						{entry.payee}
					</span>
					<span className="text-muted-foreground text-sm">
						{`${t("transactions.scheduled")} · ${t(`categories.${entry.categoryId}`)}`}
					</span>
				</div>
			</TableCell>
			<TableCell className="pe-6 text-end">
				<MoneyText
					amountCents={entry.amountCents}
					sign="always"
					className={cn("text-sm", AMOUNT_TINTS[entry.type])}
				/>
			</TableCell>
		</TableRow>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because they never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function TransactionsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-32" />
				</div>
				<Skeleton className="h-9 w-56 max-w-full" />
			</div>
			<Skeleton className="h-9 w-48" />
			<Card className="gap-0 py-0">
				{SKELETON_ROWS.map((key) => (
					<div key={key} className="border-b px-6 py-3 last:border-b-0">
						<Skeleton className="h-10 w-full" />
					</div>
				))}
			</Card>
		</div>
	);
}

/** Error state of the list and detail pages when the loader fails. Try again runs the loader again. */
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
