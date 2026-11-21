// The Reports page behind login, in the anatomy of the kit default dashboard: the title with a period select
// and a download button, then a 3-column grid: schedules, sign-ups, retention, notes, active users (2 columns),
// recent sign-ups (2 columns), and the schedule form. The /app/reports route renders it after its loader.
// The page holds the period. The schedules and notes cards read their own queries and do not change with it.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	DEFAULT_DAYS,
	dayCountFormat,
	downloadCsv,
	fillMessage,
	type PeriodDays,
	PeriodSelect,
	toCsv,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { type Reports, reportsQueryOptions } from "../api/reports.queries";
import { ActiveUsersCard } from "./active-users-card";
import { NotesCard } from "./notes-card";
import { RecentSignUpsCard } from "./recent-sign-ups-card";
import { RetentionCard } from "./retention-card";
import { ScheduleFormCard } from "./schedule-form-card";
import { SchedulesCard } from "./schedules-card";
import { SignUpsCard } from "./sign-ups-card";

// 3 columns from the 4xl container width, as the kit page from its lg screen. One minmax(0, 1fr) column below.
const PAGE_GRID = "grid grid-cols-1 gap-4 @4xl/main:grid-cols-3";
const WIDE_CARD = "@4xl/main:col-span-2";

/** The period select changes the active users and the recent sign-ups. The weekly cards always show 8 weeks. */
export function ReportsPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const reports = useQuery({
		...reportsQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const period = dayCountFormat(locale).format(days);

	function exportSignUps(data: Reports) {
		downloadCsv(
			`sign-ups-last-${days}-days.csv`,
			toCsv(data.signUps, [
				{ header: t("reports.recent.columns.user"), value: (row) => row.name },
				{
					header: t("reports.recent.columns.email"),
					value: (row) => row.email,
				},
				{
					header: t("reports.recent.columns.account"),
					value: (row) => row.accountName,
				},
				{
					header: t("reports.recent.columns.channel"),
					value: (row) => t(`channels.${row.channel}`),
				},
				{
					header: t("reports.recent.columns.status"),
					value: (row) => t(`reports.statuses.${row.status}`),
				},
				{
					header: t("reports.recent.columns.joined"),
					value: (row) => row.joinedAt,
				},
			]),
		);
	}

	return (
		// grid-cols-1 is minmax(0, 1fr): the page column keeps the width of the main area, not of its widest card.
		<div className="grid grid-cols-1 gap-4">
			<PageHeader
				title={t("reports.title")}
				description={fillMessage(t("reports.description"), { period })}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							type="button"
							aria-label={t("reports.download")}
							disabled={reports.data === undefined}
							onClick={() => {
								if (reports.data) {
									exportSignUps(reports.data);
								}
							}}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">{t("reports.download")}</span>
						</Button>
					</>
				}
			/>
			{reports.isError ? (
				<div className="grid justify-items-start gap-3 rounded-surface border p-6">
					<p className="text-sm" role="alert">
						{t("reports.loadError")}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => reports.refetch()}
					>
						{t("common.retry")}
					</Button>
				</div>
			) : reports.data === undefined ? (
				<ReportsGridSkeleton />
			) : (
				<div className={PAGE_GRID}>
					<SchedulesCard />
					<SignUpsCard
						weeks={reports.data.signUpWeeks}
						totals={reports.data.signUpTotals}
					/>
					<RetentionCard
						cohorts={reports.data.retention}
						average={reports.data.retentionAverage}
					/>
					<NotesCard />
					<div className={WIDE_CARD}>
						<ActiveUsersCard points={reports.data.activeUsers} days={days} />
					</div>
					<div className={WIDE_CARD}>
						<RecentSignUpsCard signUps={reports.data.signUps} period={period} />
					</div>
					<ScheduleFormCard />
				</div>
			)}
		</div>
	);
}

// Placeholder keys of the first row. Fixed keys, because the cards never reorder.
const SKELETON_SMALL = ["1", "2", "3"];

// The grid of cards while the reports load, in the same spans.
function ReportsGridSkeleton() {
	return (
		<div className={PAGE_GRID}>
			{SKELETON_SMALL.map((key) => (
				<Skeleton key={key} className="h-64" />
			))}
			<Skeleton className="h-96" />
			<Skeleton className={`h-96 ${WIDE_CARD}`} />
			<Skeleton className={`h-128 ${WIDE_CARD}`} />
			<Skeleton className="h-128" />
		</div>
	);
}

/** Placeholder while the Reports loader runs. The route sets it as pendingComponent. */
export function ReportsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-64 max-w-full" />
			</div>
			<ReportsGridSkeleton />
		</div>
	);
}

/** Error state of the Reports page when the loader fails. Try again runs the loader again. */
export function ReportsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("reports.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
