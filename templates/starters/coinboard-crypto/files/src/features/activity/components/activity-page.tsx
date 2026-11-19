// The Activity page, in the kit transactions anatomy: a title row with a period select and a download button,
// Latest and Pending tabs, then one card with a row per transaction: the date, the line and its status, the signed amount,
// and a button that opens the side panel. The open transaction lives in the URL (?tx=), so other pages link to it.
// The /app/activity route renders it after its loader. The route also uses the skeleton and the error below.
import { CalendarBlankIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	dayCountFormat,
	downloadCsv,
	fillMessage,
	PERIOD_DAYS,
	toCsv,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { transactionsQueryOptions } from "../api/transactions.queries";
import {
	type ActivityPeriod,
	filterByPeriod,
	parseActivityPeriod,
} from "../lib/activity-filters";
import { transactionCsvColumns } from "../lib/transaction-csv";
import { TransactionRows } from "./transaction-rows";
import { TransactionSheet } from "./transaction-sheet";

/** The list page. The period filters both tabs. "Latest" holds the confirmed and failed rows, "Pending" the rest. */
export function ActivityPage() {
	const { t, locale } = useT();
	const { data: transactions } = useSuspenseQuery(transactionsQueryOptions());
	const [period, setPeriod] = useState<ActivityPeriod>(30);
	const [tab, setTab] = useState("latest");
	const [page, setPage] = useState(1);
	// The open transaction lives in the URL, so the bell and the asset page can link to it.
	const { tx: openId } = useSearch({ from: "/app/activity" });
	const navigate = useNavigate();

	const dayCount = dayCountFormat(locale);
	const inPeriod = filterByPeriod(transactions, period, Date.now());
	const latest = inPeriod.filter((row) => row.status !== "pending");
	const pending = inPeriod.filter((row) => row.status === "pending");
	const shown = tab === "pending" ? pending : latest;

	function changePeriod(value: string) {
		setPeriod(parseActivityPeriod(value));
		setPage(1);
	}

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("activity.title")}
				actions={
					<>
						<Select value={String(period)} onValueChange={changePeriod}>
							<SelectTrigger
								aria-label={t("chart.period")}
								className="w-44 sm:w-48"
							>
								<CalendarBlankIcon />
								<SelectValue />
							</SelectTrigger>
							<SelectContent align="end">
								{PERIOD_DAYS.map((days) => (
									<SelectItem key={days} value={String(days)}>
										{fillMessage(t("activity.lastDays"), {
											days: dayCount.format(days),
										})}
									</SelectItem>
								))}
								<SelectItem value="all">{t("activity.allTime")}</SelectItem>
							</SelectContent>
						</Select>
						<Button
							type="button"
							size="icon"
							aria-label={t("common.exportCsv")}
							onClick={() =>
								downloadCsv(
									"activity.csv",
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
					setTab(value);
					setPage(1);
				}}
				className="min-w-0 gap-2"
			>
				<TabsList>
					<TabsTrigger value="latest">{t("activity.latest")}</TabsTrigger>
					<TabsTrigger value="pending">{t("activity.pending")}</TabsTrigger>
				</TabsList>
				<Card className="py-0">
					<CardContent className="px-0">
						<TabsContent value="latest">
							<TransactionRows
								rows={latest}
								page={page}
								onPageChange={setPage}
								empty={t("activity.emptyLatest")}
								onOpen={(id) =>
									navigate({ to: "/app/activity", search: { tx: id } })
								}
							/>
						</TabsContent>
						<TabsContent value="pending">
							<TransactionRows
								rows={pending}
								page={page}
								onPageChange={setPage}
								empty={t("activity.emptyPending")}
								onOpen={(id) =>
									navigate({ to: "/app/activity", search: { tx: id } })
								}
							/>
						</TabsContent>
					</CardContent>
				</Card>
			</Tabs>
			<TransactionSheet
				transaction={transactions.find((row) => row.id === openId) ?? null}
				onClose={() => navigate({ to: "/app/activity", search: {} })}
			/>
		</div>
	);
}

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function ActivityPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-8 w-40" />
			<Skeleton className="h-9 w-48" />
			<Skeleton className="h-112" />
		</div>
	);
}

/** Error state of the list when the loader fails. Try again runs the loader again. */
export function ActivityPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("activity.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
