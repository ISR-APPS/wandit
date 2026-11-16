// The home of the HR desk, in the digest form: one column that reads like a weekly letter.
// The /app route renders it after its loader. The period (7 or 30 days) lives in the URL; the page reads every query.
// The summary repeats the figure of each section h2, so the prose and the sections always agree.
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import {
	candidatesQueryOptions,
	dailyApplicationsQueryOptions,
} from "~/features/hiring";
import { periodDayKeys, startOfLocalDay, totalsOf } from "~/features/people";
import {
	absenceByDepartmentQueryOptions,
	absenceByTypeQueryOptions,
	dailyAbsenceQueryOptions,
	timeOffRequestsQueryOptions,
} from "~/features/time-off";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { DEFAULT_DAYS } from "../lib/digest-period";
import { AbsenceSection } from "./absence-section";
import { DigestSummary } from "./digest-summary";
import { HiringSection } from "./hiring-section";
import { PeriodTabs } from "./period-tabs";
import { RequestsSection } from "./requests-section";

const routeApi = getRouteApi("/app/");

/** The digest page. A period change writes ?days= to the URL, and the route loader fills the new queries. */
export function OverviewPage() {
	const { t, locale } = useT();
	const { days = DEFAULT_DAYS } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	const { data: dailyAbsence } = useSuspenseQuery(
		dailyAbsenceQueryOptions(days),
	);
	const { data: absenceByType } = useSuspenseQuery(
		absenceByTypeQueryOptions(days),
	);
	const { data: departments } = useSuspenseQuery(
		absenceByDepartmentQueryOptions(days),
	);
	const { data: applications } = useSuspenseQuery(
		dailyApplicationsQueryOptions(days),
	);
	const { data: requests } = useSuspenseQuery(timeOffRequestsQueryOptions());
	const { data: candidates } = useSuspenseQuery(candidatesQueryOptions());

	const absence = totalsOf(dailyAbsence);
	const applicationTotals = totalsOf(applications);
	const pendingCount = requests.filter(
		(request) => request.status === "pending",
	).length;
	const dayKeys = periodDayKeys(days, startOfLocalDay(Date.now()));
	const range = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "long",
	}).formatRange(
		new Date(`${dayKeys[0]}T00:00:00`),
		new Date(`${dayKeys[dayKeys.length - 1]}T00:00:00`),
	);

	return (
		<div className="mx-auto flex w-full max-w-[60rem] flex-col gap-8">
			<header className="grid gap-5">
				<div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
					<div className="grid gap-1">
						<p className="text-muted-foreground text-sm">{range}</p>
						<h1 className="font-(--heading-weight) font-display text-3xl tracking-(--heading-tracking)">
							{t(days === 7 ? "overview.titleWeek" : "overview.titleMonth")}
						</h1>
					</div>
					<PeriodTabs
						days={days}
						onDaysChange={(next) =>
							navigate({
								// The default week keeps the plain /app URL.
								search: { days: next === DEFAULT_DAYS ? undefined : next },
								replace: true,
								resetScroll: false,
							})
						}
					/>
				</div>
				<DigestSummary
					daysOff={absence.current}
					daysOffChange={absence.change}
					toReview={pendingCount}
					applications={applicationTotals.current}
					applicationsChange={applicationTotals.change}
				/>
			</header>
			<AbsenceSection
				total={absence.current}
				points={absenceByType}
				slices={departments}
			/>
			<RequestsSection requests={requests} days={days} />
			<HiringSection points={applications} candidates={candidates} />
		</div>
	);
}

/** Placeholder while the home loader runs: the header, the summary lines, and two sections. */
export function OverviewPageSkeleton() {
	return (
		<div className="mx-auto flex w-full max-w-[60rem] flex-col gap-8">
			<div className="grid gap-5">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div className="grid gap-2">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-9 w-48" />
					</div>
					<Skeleton className="h-9 w-44" />
				</div>
				<div className="grid max-w-prose gap-2">
					<Skeleton className="h-7 w-full" />
					<Skeleton className="h-7 w-4/5" />
				</div>
			</div>
			{["absence", "requests"].map((key) => (
				<Card key={key}>
					<CardContent className="grid gap-4">
						<div className="flex justify-between">
							<Skeleton className="h-7 w-40" />
							<Skeleton className="h-8 w-16" />
						</div>
						<Skeleton className="h-4 w-64" />
						<Skeleton className="h-52 w-full" />
					</CardContent>
				</Card>
			))}
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
