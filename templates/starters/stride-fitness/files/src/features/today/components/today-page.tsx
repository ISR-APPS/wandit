// The home behind login: a briefing of the gym day. A greeting, one sentence about the floor,
// today's classes as a timeline, the progress of the day, the figures of 7 days, and the check-ins per day.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
import type { Session } from "@supabase/supabase-js";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { classSessionsQueryOptions } from "~/features/classes";
import { startOfLocalDay, toDayKey, useNow } from "~/features/gym";
import { profileQueryOptions } from "~/features/profile";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { weekKpisQueryOptions } from "../api/today.queries";
import { buildDayBrief, buildDayProgress } from "../lib/day-brief";
import type { PeriodDays } from "../lib/series";
import { AgendaCard } from "./agenda-card";
import { CheckInsTrendCard } from "./check-ins-trend-card";
import { DayProgressCard } from "./day-progress-card";
import { WeekFiguresCard } from "./week-figures-card";

/** The period of the trend on the first load, in days. The loader prefetches it. */
export const DEFAULT_DAYS: PeriodDays = 30;

type TodayPageProps = {
	/** The session of the /app layout. The greeting reads the profile of `session.user.id`. */
	session: Session;
};

/** The timeline is the main block. The figures are a ruled list beside it, never a row of equal cards. */
export function TodayPage({ session }: TodayPageProps) {
	const { t, locale } = useT();
	const now = useNow();
	const { data: profile } = useSuspenseQuery(
		profileQueryOptions(session.user.id),
	);
	const { data: sessions } = useSuspenseQuery(classSessionsQueryOptions());
	const { data: kpis } = useSuspenseQuery(weekKpisQueryOptions());
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);

	// LIMIT: the week query holds about 50 sessions; the home filters today in the browser. Upgrade: a query of one day.
	const todayKey = toDayKey(startOfLocalDay(now));
	const todayRows = sessions.filter(
		(row) => toDayKey(row.startsAt) === todayKey,
	);
	// The greeting uses the first word of the name. An empty name gives the greeting alone.
	const firstName = profile.fullName.trim().split(/\s+/)[0] ?? "";
	const greeting = firstName
		? `${t("today.greeting")}, ${firstName}`
		: t("today.greeting");
	const brief = buildDayBrief(todayRows, now);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const linkClass =
		"font-medium text-foreground underline-offset-4 hover:underline";

	return (
		<div className="grid gap-6">
			<PageHeader
				title={greeting}
				description={
					<>
						{`${date.format(now)}. `}
						{brief.kind === "done" ? (
							t("today.nothingElse")
						) : (
							<>
								{`${t(brief.kind === "live" ? "today.liveNow" : "today.next")} `}
								<Link
									to="/app/classes"
									search={{ day: todayKey, session: brief.row.id }}
									className={linkClass}
								>
									{brief.row.className}
								</Link>
								{`, ${brief.kind === "live" ? `${t("today.until")} ` : ""}`}
								{/* The time never breaks between its digits and AM or PM. */}
								<span className="whitespace-nowrap">
									{time.format(
										brief.kind === "live"
											? brief.row.endsAt
											: brief.row.startsAt,
									)}
								</span>
							</>
						)}
					</>
				}
			/>
			<div className="grid @4xl/main:grid-cols-5 grid-cols-1 @3xl/main:gap-6 gap-4">
				<AgendaCard
					rows={todayRows}
					now={now}
					className="@4xl/main:col-span-3 @4xl/main:row-span-2"
				/>
				<DayProgressCard
					progress={buildDayProgress(todayRows, now)}
					className="@4xl/main:col-span-2"
				/>
				<WeekFiguresCard
					items={kpis.map((kpi) => ({ ...kpi, label: t(kpi.labelKey) }))}
					className="@4xl/main:col-span-2"
				/>
				<CheckInsTrendCard
					days={days}
					onDaysChange={setDays}
					className="@4xl/main:col-span-5"
				/>
			</div>
		</div>
	);
}

/** Placeholder while the home loader runs: the greeting lines, the tall agenda, and the end column. */
export function TodayPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<div className="grid @4xl/main:grid-cols-5 grid-cols-1 @3xl/main:gap-6 gap-4">
				<Skeleton className="@4xl/main:col-span-3 @4xl/main:row-span-2 h-[36rem]" />
				<Skeleton className="@4xl/main:col-span-2 h-60" />
				<Skeleton className="@4xl/main:col-span-2 h-80" />
				<Skeleton className="@4xl/main:col-span-5 h-80" />
			</div>
		</div>
	);
}

/** Error state of the home when the loader fails. Try again runs the loader again. */
export function TodayPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("today.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
