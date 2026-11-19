// The visits card of the home: visits of women, men, and children over the period, with a department select.
// DashboardPage renders it in the 4/7 column of the Overview tab. The chart file loads with React.lazy.
// The department is state of the card and goes into the query key, so each choice has its own cache entry.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { type PeriodDays, SPECIALTIES } from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { visitSeriesQueryOptions } from "../api/dashboard.queries";
import {
	type DepartmentFilter,
	VISIT_GROUP_COLORS,
	VISIT_GROUPS,
	visitBucketDays,
} from "../lib/summary";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const VisitsChart = lazy(() =>
	import("./visits-chart").then((module) => ({ default: module.VisitsChart })),
);

// The department choices of the select, "all" first.
const DEPARTMENT_FILTERS: DepartmentFilter[] = ["all", ...SPECIALTIES];

type VisitsCardProps = {
	/** The period of the page, in days. */
	days: PeriodDays;
};

/** The legend under the plot names each line, so the color is never the only mark. */
export function VisitsCard({ days }: VisitsCardProps) {
	const { t } = useT();
	const [department, setDepartment] = useState<DepartmentFilter>("all");
	// A new period or department keeps the old line until the new one is ready.
	const series = useQuery({
		...visitSeriesQueryOptions(days, department),
		placeholderData: keepPreviousData,
	});

	return (
		<Card className="@4xl/main:col-span-4">
			<CardHeader>
				<CardTitle>{t("dashboard.visitsTitle")}</CardTitle>
				<CardAction>
					<Select
						value={department}
						onValueChange={(value) =>
							setDepartment(
								DEPARTMENT_FILTERS.find((option) => option === value) ?? "all",
							)
						}
					>
						<SelectTrigger
							aria-label={t("dashboard.department")}
							className="w-auto"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							{DEPARTMENT_FILTERS.map((option) => (
								<SelectItem key={option} value={option}>
									{option === "all"
										? t("dashboard.allDepartments")
										: t(`specialties.${option}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				{series.isError ? (
					<div className="grid h-72 content-center justify-items-center gap-3 text-center">
						<p className="text-muted-foreground text-sm" role="alert">
							{t("dashboard.visitsError")}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => series.refetch()}
						>
							{t("common.retry")}
						</Button>
					</div>
				) : series.data === undefined ? (
					<Skeleton className="@4xl/main:h-96 h-72 w-full" />
				) : (
					<Suspense
						fallback={<Skeleton className="@4xl/main:h-96 h-72 w-full" />}
					>
						<VisitsChart
							points={series.data}
							bucketDays={visitBucketDays(days)}
						/>
					</Suspense>
				)}
				<ul className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-muted-foreground text-xs">
					{VISIT_GROUPS.map((group) => (
						<li key={group} className="flex items-center gap-1.5">
							<span
								aria-hidden="true"
								className="size-2 rounded-full"
								style={{ backgroundColor: VISIT_GROUP_COLORS[group] }}
							/>
							{t(`dashboard.groups.${group}`)}
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
