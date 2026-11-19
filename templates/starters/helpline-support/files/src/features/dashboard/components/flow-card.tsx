// The flow card of the home: the tickets created against the tickets solved, per day of the period.
// DashboardPage renders it first in the middle grid. The chart file loads with React.lazy.
// The tabs pick the series: both, created only, or solved only. The legend under the chart gives the totals.
import { lazy, Suspense, useState } from "react";
import { fillMessage } from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import type { FlowPoint } from "../api/dashboard.queries";
import type { FlowSeries } from "./flow-chart";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const FlowChart = lazy(() =>
	import("./flow-chart").then((module) => ({ default: module.FlowChart })),
);

/** The tab values, in order. "both" draws the two series. */
const FLOW_VIEWS = ["both", "created", "solved"] as const;
type FlowView = (typeof FLOW_VIEWS)[number];

/** The series that each tab draws. */
const VIEW_SERIES = {
	both: ["created", "solved"],
	created: ["created"],
	solved: ["solved"],
} satisfies Record<FlowView, FlowSeries[]>;

/** The legend color of each series, the same as the chart config of FlowChart. */
const SERIES_COLOR = {
	created: "var(--chart-1)",
	solved: "var(--chart-2)",
} satisfies Record<FlowSeries, string>;

type FlowCardProps = {
	/** One point per day of the period, oldest first. */
	points: FlowPoint[];
};

/** The tab is state in the card. It changes the drawn series, not the query. */
export function FlowCard({ points }: FlowCardProps) {
	const { t, locale } = useT();
	const [view, setView] = useState<FlowView>("both");
	const number = new Intl.NumberFormat(locale);
	const totals = {
		created: points.reduce((sum, point) => sum + point.created, 0),
		solved: points.reduce((sum, point) => sum + point.solved, 0),
	} satisfies Record<FlowSeries, number>;
	const series: FlowSeries[] = VIEW_SERIES[view];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("dashboard.flowTitle")}</CardTitle>
				<CardDescription>{t("dashboard.flowDescription")}</CardDescription>
				<CardAction>
					<Tabs
						value={view}
						onValueChange={(value) =>
							setView(FLOW_VIEWS.find((option) => option === value) ?? "both")
						}
					>
						<TabsList>
							{FLOW_VIEWS.map((option) => (
								<TabsTrigger key={option} value={option}>
									{t(`dashboard.flowViews.${option}`)}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-6">
				<Suspense fallback={<Skeleton className="h-56 w-full" />}>
					<FlowChart
						points={points}
						series={series}
						label={fillMessage(t("dashboard.flowLabel"), {
							created: number.format(totals.created),
							solved: number.format(totals.solved),
						})}
					/>
				</Suspense>
				<ul className="flex justify-around gap-2">
					{(["created", "solved"] as const).map((key) => (
						<li key={key} className="grid min-w-0 gap-1">
							<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
								<span
									aria-hidden="true"
									className="size-2 shrink-0 rounded-full"
									style={{ backgroundColor: SERIES_COLOR[key] }}
								/>
								<span className="truncate">{t(`dashboard.${key}`)}</span>
							</span>
							<span className="ms-3.5 font-numeric font-semibold text-lg tabular-nums">
								{number.format(totals[key])}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
