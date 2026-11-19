// The wide card of the home: all events of the period with their delta, the events per weekday as bars,
// and the 3 busiest feature areas as boxed rows with a share bar. OverviewPage renders it beside the activation card.
// The bar chart loads with React.lazy. "Export" downloads the weekday counts or the area counts as CSV.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { lazy, Suspense } from "react";
import {
	ChangePill,
	changeRatio,
	downloadCsv,
	shareOf,
	toCsv,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import type { AreaEvents } from "../api/overview.queries";
import { AREA_ICONS } from "../lib/area-icons";
import { weekdayName } from "../lib/weekdays";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const WeekdayBars = lazy(() =>
	import("./weekday-bars").then((module) => ({
		default: module.WeekdayBars,
	})),
);

// The kit card shows three boxed rows beside the chart.
const BOXED_AREAS = 3;

type EventVolumeCardProps = {
	/** The description line, already translated: it names the period. */
	description: string;
	/** All events of the period, and of the period before. */
	events: { current: number; previous: number };
	/** All events per weekday, Monday first. */
	weekdayEvents: number[];
	/** The busiest feature areas, the most events first. */
	areas: AreaEvents[];
};

/** Two columns from the 2xl container width: the total and the bars, then the area rows. */
export function EventVolumeCard({
	description,
	events,
	weekdayEvents,
	areas,
}: EventVolumeCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const change = changeRatio(events.current, events.previous);

	function exportWeekdays() {
		const rows = weekdayEvents.map((count, index) => ({
			id: String(index),
			day: weekdayName(index, locale, "long"),
			count,
		}));
		downloadCsv(
			"events-by-weekday.csv",
			toCsv(rows, [
				{ header: t("overview.volume.weekday"), value: (row) => row.day },
				{
					header: t("overview.volume.events"),
					value: (row) => String(row.count),
				},
			]),
		);
	}

	function exportAreas() {
		downloadCsv(
			"events-by-area.csv",
			toCsv(
				areas.map((area) => ({ id: area.area, ...area })),
				[
					{
						header: t("overview.volume.area"),
						value: (row) => t(`areas.${row.area}`),
					},
					{
						header: t("overview.volume.events"),
						value: (row) => String(row.current),
					},
				],
			),
		);
	}

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("overview.volume.title")}</CardTitle>
				<CardDescription>{description}</CardDescription>
				<CardAction>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								aria-label={t("overview.volume.export")}
							>
								<DownloadSimpleIcon />
								<span className="hidden lg:inline">
									{t("overview.volume.export")}
								</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onSelect={exportWeekdays}>
								{t("overview.volume.byWeekday")}
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={exportAreas}>
								{t("overview.volume.byArea")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</CardAction>
			</CardHeader>
			<CardContent>
				<div className="grid @2xl/main:grid-cols-2 gap-4">
					<div className="grid content-start gap-4">
						<div className="flex items-center gap-2">
							<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
								{number.format(events.current)}
							</p>
							{change === null ? null : (
								<ChangePill change={change} goodWhen="up" />
							)}
						</div>
						<Suspense fallback={<Skeleton className="h-60" />}>
							<WeekdayBars counts={weekdayEvents} />
						</Suspense>
					</div>
					<ul className="grid content-start gap-4">
						{areas.slice(0, BOXED_AREAS).map((area) => {
							const Icon = AREA_ICONS[area.area];
							const share = shareOf(area.current, events.current);
							return (
								<li
									key={area.area}
									className="grid gap-4 rounded-md border bg-muted p-4"
								>
									<div className="flex items-center justify-between gap-4">
										<div className="flex min-w-0 items-center gap-4">
											<span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
												<Icon className="size-4" />
											</span>
											<span className="truncate">
												{t(`areas.${area.area}`)}
											</span>
										</div>
										<span className="font-semibold tabular-nums">
											{number.format(area.current)}
										</span>
									</div>
									<Progress
										value={share * 100}
										className="h-1"
										aria-label={t(`areas.${area.area}`)}
									/>
								</li>
							);
						})}
					</ul>
				</div>
			</CardContent>
		</Card>
	);
}
