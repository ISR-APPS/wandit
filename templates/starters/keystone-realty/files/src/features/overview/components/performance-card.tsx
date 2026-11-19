// The performance card of the home: new leads and viewings over time, with the scale tabs D, W, and M.
// OverviewPage renders it full width under the KPI row. The chart file loads with React.lazy.
// The scale is state of the card. The three series come from one read of the home summary.
import { lazy, Suspense, useState } from "react";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	PERFORMANCE_SCALES,
	type PerformancePoint,
	type PerformanceScale,
} from "../lib/series";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const PerformanceChart = lazy(() =>
	import("./performance-chart").then((module) => ({
		default: module.PerformanceChart,
	})),
);

type PerformanceCardProps = {
	/** The points of each scale, oldest first. */
	series: Record<PerformanceScale, PerformancePoint[]>;
};

/** The legend under the title names both series, so the line color is never the only mark. */
export function PerformanceCard({ series }: PerformanceCardProps) {
	const { t } = useT();
	const [scale, setScale] = useState<PerformanceScale>("week");

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg">
					{t("overview.performance.title")}
				</CardTitle>
				<ul className="flex flex-wrap items-center gap-3 text-sm">
					<li className="flex items-center gap-1.5">
						<span
							aria-hidden="true"
							className="size-2 rounded-full bg-primary"
						/>
						{t("overview.performance.leads")}
					</li>
					<li className="flex items-center gap-1.5">
						<span
							aria-hidden="true"
							className="size-2 rounded-full bg-muted-foreground"
						/>
						{t("overview.performance.viewings")}
					</li>
				</ul>
				<CardAction>
					<Tabs
						value={scale}
						onValueChange={(value) => {
							const next = PERFORMANCE_SCALES.find(
								(option) => option === value,
							);
							if (next) {
								setScale(next);
							}
						}}
					>
						<TabsList>
							{PERFORMANCE_SCALES.map((option) => (
								<TabsTrigger
									key={option}
									value={option}
									aria-label={t(`overview.performance.scales.${option}`)}
									title={t(`overview.performance.scales.${option}`)}
								>
									{t(`overview.performance.scaleShort.${option}`)}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</CardAction>
			</CardHeader>
			<CardContent>
				<Suspense fallback={<Skeleton className="h-60 w-full" />}>
					<PerformanceChart points={series[scale]} scale={scale} />
				</Suspense>
			</CardContent>
		</Card>
	);
}
