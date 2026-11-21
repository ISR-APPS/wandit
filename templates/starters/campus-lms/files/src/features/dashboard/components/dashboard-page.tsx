// The home behind login, in the band order of the kit academy page: the welcome, course progress, and leaderboard band;
// the pass rate, grading, and activity band; then the lessons trend beside the table of the assignments due.
// The /app route renders it after its loader, and also uses the skeleton and the error below.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { dashboardSummaryQueryOptions } from "../api/dashboard.queries";
import { ActivityCard } from "./activity-card";
import { CoursePathsCard } from "./course-paths-card";
import { DueAssignmentsCard } from "./due-assignments-card";
import { GradingCard } from "./grading-card";
import { LeaderboardCard } from "./leaderboard-card";
import { LessonsTrendCard } from "./lessons-trend-card";
import { PassRateCard } from "./pass-rate-card";
import { WelcomeCard } from "./welcome-card";

// The grid of each band. The top band has 4 columns from 64rem: the welcome card takes 2.
const TOP_BAND = "grid gap-4 @2xl/main:grid-cols-2 @5xl/main:grid-cols-4";
const MIDDLE_BAND = "grid gap-4 @4xl/main:grid-cols-3";
const BOTTOM_BAND = "grid gap-4 @4xl/main:grid-cols-2";

/** Three bands. One column on a phone. */
export function DashboardPage() {
	const { t, locale } = useT();
	const { data: summary } = useSuspenseQuery(dashboardSummaryQueryOptions());
	const today = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("dashboard.title")}
				description={today.format(Date.now())}
			/>
			<div className={TOP_BAND}>
				<div className="@2xl/main:col-span-2">
					<WelcomeCard
						runningCourses={summary.runningCourses}
						toGrade={summary.toGrade}
						classesToday={summary.classesToday}
					/>
				</div>
				<CoursePathsCard paths={summary.paths} />
				<LeaderboardCard leaders={summary.leaders} />
			</div>
			<div className={MIDDLE_BAND}>
				<PassRateCard passRate={summary.passRate} />
				<GradingCard grading={summary.grading} />
				<ActivityCard activity={summary.activity} />
			</div>
			<div className={BOTTOM_BAND}>
				<LessonsTrendCard />
				<DueAssignmentsCard />
			</div>
		</div>
	);
}

// Placeholder keys of the cards. Fixed keys, because the cards never reorder.
const SKELETON_SIDE_CARDS = ["paths", "leaders"];
const SKELETON_MIDDLE_CARDS = ["pass", "grading", "activity"];
const SKELETON_BOTTOM_CARDS = ["trend", "due"];

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function DashboardPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-56 max-w-full" />
			</div>
			<div className={TOP_BAND}>
				<Skeleton className="@2xl/main:col-span-2 h-80" />
				{SKELETON_SIDE_CARDS.map((key) => (
					<Skeleton key={key} className="h-80" />
				))}
			</div>
			<div className={MIDDLE_BAND}>
				{SKELETON_MIDDLE_CARDS.map((key) => (
					<Skeleton key={key} className="h-104" />
				))}
			</div>
			<div className={BOTTOM_BAND}>
				{SKELETON_BOTTOM_CARDS.map((key) => (
					<Skeleton key={key} className="h-112" />
				))}
			</div>
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function DashboardPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("dashboard.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
