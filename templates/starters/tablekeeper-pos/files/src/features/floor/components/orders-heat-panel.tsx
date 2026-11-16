// The "Checks per day" panel of the floor: 2 KPI figures, the heat calendar or strip, the facts, and the legend.
// FloorPage renders it under the walls and holds its period. The period Select changes the query key only.
// It reads dailyChecksQueryOptions with useQuery, so it has its own skeleton and error.
// From the 3xl container width, the figures and the facts sit in one column and the heat in a second one.
import { useQuery } from "@tanstack/react-query";
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
import { dailyChecksQueryOptions } from "../api/floor-stats.queries";
import { type KpiItem, PERIOD_DAYS } from "../lib/series";
import { HeatBody } from "./heat-body";
import { KpiFigure } from "./kpi-figure";

type OrdersHeatPanelProps = {
	/** The 2 figures of the panel header: covers and sales of today. */
	kpis: KpiItem[];
	/** The period of the heat, in days: 7, 30, or 90. */
	days: number;
	onDaysChange: (days: number) => void;
};

/** A Card. The figures sit in its header; the period Select sits at the end of the title row. */
export function OrdersHeatPanel({
	kpis,
	days,
	onDaysChange,
}: OrdersHeatPanelProps) {
	const { t, locale } = useT();
	const dailyChecks = useQuery(dailyChecksQueryOptions(days));
	const dayUnit = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const figures = (
		<div className="grid gap-3">
			<div className="flex flex-wrap gap-x-10 gap-y-4">
				{kpis.map((item) => (
					<KpiFigure key={item.id} item={item} />
				))}
			</div>
			<p className="text-muted-foreground text-xs">{t("floor.comparedWith")}</p>
		</div>
	);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("floor.checksPerDay")}</CardTitle>
				<CardAction>
					<Select
						value={String(days)}
						onValueChange={(value) =>
							onDaysChange(
								PERIOD_DAYS.find((option) => String(option) === value) ?? days,
							)
						}
					>
						<SelectTrigger className="w-auto" aria-label={t("chart.period")}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							{PERIOD_DAYS.map((option) => (
								<SelectItem key={option} value={String(option)}>
									{dayUnit.format(option)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>
			<CardContent className="grid @3xl/main:grid-cols-[minmax(0,1fr)_auto] items-start gap-x-10 gap-y-6">
				{dailyChecks.isPending ? (
					<>
						{figures}
						<HeatBodySkeleton />
					</>
				) : dailyChecks.isError ? (
					<>
						{figures}
						<div className="grid justify-items-start gap-3">
							<p role="alert" className="text-sm">
								{t("floor.loadError")}
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => dailyChecks.refetch()}
							>
								{t("common.retry")}
							</Button>
						</div>
					</>
				) : (
					<HeatBody points={dailyChecks.data} days={days} figures={figures} />
				)}
			</CardContent>
		</Card>
	);
}

/** The calendar, the facts, and the legend in their final sizes. */
function HeatBodySkeleton() {
	return (
		<div className="grid @3xl/main:justify-items-end gap-4">
			<Skeleton className="@3xl/main:h-[226px] @xl/main:h-[136px] h-[122px] @3xl/main:w-[240px] w-[180px]" />
			<Skeleton className="h-3 w-40" />
		</div>
	);
}
