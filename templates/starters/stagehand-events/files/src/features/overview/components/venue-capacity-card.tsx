// The venue capacity card of the home: the seats on offer in the next days, split by venue, and the fill of each venue.
// OverviewPage renders it at the end of the third row with the venue loads of the home summary.
// It follows the pipeline list of recipe 3.3: a stacked share bar, then one row per venue with a progress bar.
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { countLabel, fillMessage } from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";
import type { VenueLoad } from "../lib/overview-math";
import { dayCountFormat } from "./period-select";

// One chart color per row, in row order. The summary gives at most 5 rows.
const ROW_COLORS = [
	"bg-chart-1",
	"bg-chart-2",
	"bg-chart-3",
	"bg-chart-4",
	"bg-chart-5",
];

type VenueCapacityCardProps = {
	/** The venues with the most seats ahead, then the other venues, from the home summary. */
	venueLoads: VenueLoad[];
	/** The period of the page, in days: the window ahead. */
	days: number;
};

/** The bar shows the share of the seats on offer. Each row shows the share of its seats already sold. */
export function VenueCapacityCard({
	venueLoads,
	days,
}: VenueCapacityCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const totalSeats = venueLoads.reduce((sum, row) => sum + row.capacity, 0);
	const nameOf = (row: VenueLoad) => row.name ?? t("overview.otherVenues");
	const detailOf = (row: VenueLoad) =>
		fillMessage(t("overview.venueDetail"), {
			events: countLabel(
				row.events,
				t("overview.eventOne"),
				t("overview.eventOther"),
				locale,
			),
			sold: number.format(row.sold),
			capacity: number.format(row.capacity),
		});

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.venueCapacity")}</CardTitle>
				<CardDescription>
					{fillMessage(t("overview.venueCapacityHint"), {
						period: dayCountFormat(locale).format(days),
					})}
				</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<Link to="/app/venues">
							{t("common.viewAll")}
							<ArrowRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-6">
				{venueLoads.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("overview.noEventsAhead")}
					</p>
				) : (
					<>
						<div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
							{venueLoads.map((row, index) => (
								<Tooltip key={row.venueId ?? "other"}>
									<TooltipTrigger asChild>
										<span
											className={cn("h-full", ROW_COLORS[index])}
											style={{
												width: `${(row.capacity / totalSeats) * 100}%`,
											}}
										/>
									</TooltipTrigger>
									<TooltipContent>{`${nameOf(row)}: ${detailOf(row)}`}</TooltipContent>
								</Tooltip>
							))}
						</div>
						<ul className="grid gap-4">
							{venueLoads.map((row, index) => {
								const fill = row.capacity === 0 ? 0 : row.sold / row.capacity;
								return (
									<li
										key={row.venueId ?? "other"}
										className="flex items-center gap-4"
									>
										<span
											aria-hidden="true"
											className={cn(
												"size-3 shrink-0 rounded-full",
												ROW_COLORS[index],
											)}
										/>
										<span className="grid min-w-0 flex-1 gap-0.5">
											<span className="truncate font-medium text-sm">
												{nameOf(row)}
											</span>
											<span className="truncate text-muted-foreground text-xs tabular-nums">
												{detailOf(row)}
											</span>
										</span>
										<Progress
											value={fill * 100}
											className="h-1.5 w-16"
											aria-label={nameOf(row)}
										/>
										<span className="w-10 text-end text-muted-foreground text-xs tabular-nums">
											{percent.format(fill)}
										</span>
									</li>
								);
							})}
						</ul>
					</>
				)}
			</CardContent>
		</Card>
	);
}
