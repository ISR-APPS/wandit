// The home behind login: a briefing of the day. A greeting, one sentence about the day, the agenda,
// the progress of today, the figures of the last 7 days, and the visits per day.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.

import type { Session } from "@supabase/supabase-js";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { useNow } from "~/features/clinic";
import { profileQueryOptions } from "~/features/profile";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	todayAppointmentsQueryOptions,
	weekKpisQueryOptions,
} from "../api/today.queries";
import { buildDayBrief } from "../lib/agenda";
import { buildDayProgress, type PeriodDays } from "../lib/series";
import { AgendaCard } from "./agenda-card";
import { DayProgressCard } from "./day-progress-card";
import { VisitsTrendCard } from "./visits-trend-card";
import { WeekFiguresCard } from "./week-figures-card";

/** The period of the trend on the first load, in days. The loader prefetches it. */
export const DEFAULT_DAYS: PeriodDays = 30;

type TodayPageProps = {
	/** The session of the /app layout. The greeting reads the profile of `session.user.id`. */
	session: Session;
};

/** The agenda is the main block. The figures are a ruled list beside it, never a row of equal cards. */
export function TodayPage({ session }: TodayPageProps) {
	const { t, locale } = useT();
	const now = useNow();
	const { data: profile } = useSuspenseQuery(
		profileQueryOptions(session.user.id),
	);
	const { data: appointments } = useSuspenseQuery(
		todayAppointmentsQueryOptions(),
	);
	const { data: kpis } = useSuspenseQuery(weekKpisQueryOptions());
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);

	// The greeting uses the first word of the name. An empty name gives the greeting alone.
	const firstName = profile.fullName.trim().split(/\s+/)[0] ?? "";
	const greeting = firstName
		? `${t("today.greeting")}, ${firstName}`
		: t("today.greeting");
	const brief = buildDayBrief(appointments, now);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const number = new Intl.NumberFormat(locale);
	const linkClass =
		"font-medium text-foreground underline-offset-4 hover:underline";

	return (
		<div className="grid gap-6">
			<PageHeader
				title={greeting}
				description={
					<>
						{`${date.format(now)}. `}
						{brief.kind === "late" ? (
							<Link to="/app/appointments" className={linkClass}>
								{`${t("today.lateNow")} ${number.format(brief.count)}`}
							</Link>
						) : brief.kind === "next" ? (
							<>
								{`${t("today.next")} `}
								<Link
									to="/app/appointments"
									search={{ appointment: brief.row.id }}
									className={linkClass}
								>
									{brief.row.patient.fullName}
								</Link>
								{", "}
								{/* The time never breaks between its digits and AM or PM. */}
								<span className="whitespace-nowrap">
									{time.format(brief.row.startsAt)}
								</span>
							</>
						) : (
							t("today.nothingElse")
						)}
					</>
				}
			/>
			<div className="grid @4xl/main:grid-cols-5 grid-cols-1 @3xl/main:gap-6 gap-4">
				<AgendaCard
					rows={appointments}
					now={now}
					className="@4xl/main:col-span-3 @4xl/main:row-span-2"
				/>
				<DayProgressCard
					progress={buildDayProgress(appointments, now)}
					className="@4xl/main:col-span-2"
				/>
				<WeekFiguresCard
					items={kpis.map((kpi) => ({ ...kpi, label: t(kpi.labelKey) }))}
					className="@4xl/main:col-span-2"
				/>
				<VisitsTrendCard
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
				<Skeleton className="@4xl/main:col-span-3 @4xl/main:row-span-2 h-[42rem]" />
				<Skeleton className="@4xl/main:col-span-2 h-64" />
				<Skeleton className="@4xl/main:col-span-2 h-72" />
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
