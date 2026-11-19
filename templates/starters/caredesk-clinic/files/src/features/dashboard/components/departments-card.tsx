// The departments card of the home: the patients of the period per department, as a pie with a legend.
// DashboardPage renders it in the 3/7 column of the Overview tab. The pie file loads with React.lazy.
import { lazy, Suspense } from "react";
import { SPECIALTY_TONE } from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { DepartmentSlice } from "../lib/summary";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const DepartmentsPie = lazy(() =>
	import("./departments-pie").then((module) => ({
		default: module.DepartmentsPie,
	})),
);

type DepartmentsCardProps = {
	/** Every department, also at 0, in the order of SPECIALTIES. */
	slices: DepartmentSlice[];
};

/** The legend names each slice, so the color is never the only mark. A patient seen in two departments counts in both. */
export function DepartmentsCard({ slices }: DepartmentsCardProps) {
	const { t } = useT();
	return (
		<Card className="@4xl/main:col-span-3">
			<CardHeader>
				<CardTitle>{t("dashboard.departmentsTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="grid flex-1 content-center gap-2">
				<Suspense
					fallback={
						<Skeleton className="mx-auto aspect-square w-full max-w-80 rounded-full" />
					}
				>
					<DepartmentsPie slices={slices} />
				</Suspense>
				<ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs">
					{slices.map((slice) => (
						<li key={slice.specialty} className="flex items-center gap-1.5">
							<span
								aria-hidden="true"
								className={cn(
									"size-2 rounded-sm",
									SPECIALTY_TONE[slice.specialty].dot,
								)}
							/>
							{t(`specialties.${slice.specialty}`)}
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
