// The activities page behind login: the trend of logged activities, their breakdown, the log, and the follow-up tasks.
// The /app/activities route renders it after its loader. The route also uses the skeleton and the error below.
// The page holds the period of the trend card. The other cards read cached queries.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import type { PeriodDays } from "~/features/crm";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	ACTIVITY_DEFAULT_DAYS,
	activitiesQueryOptions,
	activityBreakdownQueryOptions,
} from "../api/activities.queries";
import { openTasksQueryOptions } from "../api/tasks.queries";
import { ActivityBreakdownCard } from "./activity-breakdown-card";
import { ActivityLogCard } from "./activity-log-card";
import { ActivityTrendCard } from "./activity-trend-card";
import { FollowUpsCard } from "./follow-ups-card";

/** Two rows: the trend beside the breakdown, then the log beside the follow-up tasks. One column on a phone. */
export function ActivitiesPage() {
	const { t } = useT();
	const { data: activities } = useSuspenseQuery(
		activitiesQueryOptions(ACTIVITY_DEFAULT_DAYS),
	);
	const { data: breakdown } = useSuspenseQuery(
		activityBreakdownQueryOptions(ACTIVITY_DEFAULT_DAYS),
	);
	const { data: tasks } = useSuspenseQuery(openTasksQueryOptions());
	const [days, setDays] = useState<PeriodDays>(ACTIVITY_DEFAULT_DAYS);
	const now = Date.now();

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("activities.title")}
				description={t("activities.description")}
			/>
			{/* A rail of 20rem: the four columns of the log table need the rest of the width. */}
			<div className="grid @5xl/main:grid-cols-[minmax(0,1fr)_20rem] grid-cols-1 gap-6">
				<ActivityTrendCard days={days} onDaysChange={setDays} />
				<ActivityBreakdownCard breakdown={breakdown} />
			</div>
			<div className="grid @5xl/main:grid-cols-[minmax(0,1fr)_20rem] grid-cols-1 items-start gap-6">
				<ActivityLogCard activities={activities} now={now} />
				<FollowUpsCard tasks={tasks} now={now} />
			</div>
		</div>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function ActivitiesPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-72 max-w-full" />
			</div>
			<div className="grid @5xl/main:grid-cols-[minmax(0,1fr)_20rem] grid-cols-1 gap-6">
				<Skeleton className="h-128" />
				<Skeleton className="h-128" />
			</div>
			<div className="grid @5xl/main:grid-cols-[minmax(0,1fr)_20rem] grid-cols-1 items-start gap-6">
				<Skeleton className="h-96" />
				<Skeleton className="h-72" />
			</div>
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
