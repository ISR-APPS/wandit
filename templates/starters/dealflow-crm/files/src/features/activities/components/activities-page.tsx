// The Activities page behind login: the period and export in the header, the trend beside the breakdown,
// then the follow-up tasks and the activity log in two tabs of one table card.
// The /app/activities route renders it after its loader. The route also uses the skeleton and the error below.
// The page holds the period. The cards and the log read the queries of that period.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	dayCountFormat,
	downloadCsv,
	fillMessage,
	type PeriodDays,
	PeriodSelect,
	toCsv,
} from "~/features/crm";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	ACTIVITY_DEFAULT_DAYS,
	activitiesQueryOptions,
} from "../api/activities.queries";
import { openTasksQueryOptions } from "../api/tasks.queries";
import { activityCsvColumns } from "../lib/activity-csv";
import { ActivityBreakdownCard } from "./activity-breakdown-card";
import { ActivityLogTable } from "./activity-log-table";
import { ActivityTrendCard } from "./activity-trend-card";
import { FollowUpsTable } from "./follow-ups-table";

/** Two bands: the trend (2/3) and the breakdown (1/3), then the tabbed table card. One column on a phone. */
export function ActivitiesPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(ACTIVITY_DEFAULT_DAYS);
	const { data: tasks } = useSuspenseQuery(openTasksQueryOptions());
	const log = useQuery({
		...activitiesQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const number = new Intl.NumberFormat(locale);
	const today = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
	const now = Date.now();

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("activities.title")}
				description={fillMessage(t("period.description"), {
					period: dayCountFormat(locale).format(days),
					today: today.format(now),
				})}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							type="button"
							aria-label={t("common.exportCsv")}
							disabled={log.data === undefined}
							onClick={() =>
								downloadCsv(
									"activities.csv",
									toCsv(log.data ?? [], activityCsvColumns(t)),
								)
							}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">{t("common.exportCsv")}</span>
						</Button>
					</>
				}
			/>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<ActivityTrendCard days={days} />
				<ActivityBreakdownCard days={days} />
			</div>
			<Tabs defaultValue="tasks">
				<TabsList>
					<TabsTrigger value="tasks">
						{t("tasks.title")}
						<span className="text-muted-foreground tabular-nums">
							{number.format(tasks.length)}
						</span>
					</TabsTrigger>
					<TabsTrigger value="log">
						{t("activities.logTitle")}
						{log.data ? (
							<span className="text-muted-foreground tabular-nums">
								{number.format(log.data.length)}
							</span>
						) : null}
					</TabsTrigger>
				</TabsList>
				<Card>
					<CardContent>
						<TabsContent value="tasks">
							<FollowUpsTable tasks={tasks} now={now} />
						</TabsContent>
						<TabsContent value="log">
							{log.isError ? (
								<div className="grid justify-items-start gap-3">
									<p className="text-sm" role="alert">
										{t("activities.logError")}
									</p>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => log.refetch()}
									>
										{t("common.retry")}
									</Button>
								</div>
							) : log.data === undefined ? (
								<Skeleton className="h-96 w-full" />
							) : (
								<ActivityLogTable activities={log.data} now={now} />
							)}
						</TabsContent>
					</CardContent>
				</Card>
			</Tabs>
		</div>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function ActivitiesPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-64 max-w-full" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<Skeleton className="@4xl/main:col-span-2 h-112" />
				<Skeleton className="h-112" />
			</div>
			<Skeleton className="h-9 w-56" />
			<Skeleton className="h-96" />
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function ActivitiesPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("activities.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
