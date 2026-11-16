// Section 1 of the digest, the main activity: days off in the period, per day and type, then by department.
// OverviewPage renders it with the period total, the stacked series, and the department slices of the period.
// The total equals the sum of the bars and the sum of the department rows.

import { lazy, Suspense } from "react";
import {
	type CategoryPoint,
	TIME_OFF_TYPES,
	type TimeOffType,
	TimeOffTypeMark,
} from "~/features/people";
import type { DepartmentSlice } from "~/features/time-off";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import { DigestSectionHeader } from "./digest-section-header";

// recharts weighs about 330 kB. The lazy chunk keeps it out of the first script of every page.
const AbsenceTrendChart = lazy(() => import("./absence-trend-chart"));

type AbsenceSectionProps = {
	/** Person-days off in the period: the h2 figure. */
	total: number;
	/** Person-days off per day and type in the period. */
	points: CategoryPoint<TimeOffType>[];
	/** Person-days off by department in the period, largest first. */
	slices: DepartmentSlice[];
};

/** The time-off section: the stacked bars of the period and the ranked departments. */
export function AbsenceSection({ total, points, slices }: AbsenceSectionProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const sliceTotal = slices.reduce((sum, slice) => sum + slice.value, 0);
	return (
		<Card className="gap-5">
			<DigestSectionHeader
				title={t("overview.daysOffTitle")}
				figure={number.format(total)}
				figureLabel={t("overview.daysOffUnit")}
				to="/app/time-off"
				linkLabel={t("overview.seeTimeOff")}
				description={
					<ul className="flex flex-wrap gap-x-4 gap-y-1">
						{TIME_OFF_TYPES.map((type) => (
							<li key={type}>
								<TimeOffTypeMark type={type} />
							</li>
						))}
					</ul>
				}
			/>
			<CardContent className="grid gap-6">
				{total === 0 ? (
					<p className="grid h-52 place-items-center text-muted-foreground text-sm">
						{t("overview.daysOffEmpty")}
					</p>
				) : (
					<Suspense fallback={<Skeleton className="h-52 w-full" />}>
						<AbsenceTrendChart points={points} />
					</Suspense>
				)}
				<div className="grid gap-3">
					<h3 className="font-medium font-sans text-sm">
						{t("overview.byDepartment")}
					</h3>
					<ol className="grid @2xl/main:grid-flow-col @2xl/main:grid-cols-2 @2xl/main:grid-rows-3 gap-x-10 gap-y-3">
						{slices.map((slice, index) => {
							const label =
								slice.label === "other"
									? t("chart.other")
									: t(`departments.${slice.label}`);
							return (
								<li
									key={slice.label}
									className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-x-3 gap-y-1.5 text-sm"
								>
									<span className="font-numeric text-muted-foreground tabular-nums">
										{number.format(index + 1)}
									</span>
									<span className="truncate">{label}</span>
									<span className="font-medium tabular-nums">
										{number.format(slice.value)}
									</span>
									{/* The kit bar fills with ink. The primary fill matches the chart palette of the theme. */}
									<Progress
										value={slice.value}
										max={sliceTotal}
										aria-label={label}
										className="col-start-2 col-end-4 h-1.5 [&>div]:bg-primary"
									/>
								</li>
							);
						})}
					</ol>
				</div>
			</CardContent>
		</Card>
	);
}
