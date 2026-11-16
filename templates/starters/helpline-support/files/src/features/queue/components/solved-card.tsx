// The Solved panel of the home: the desk figures of the period, then the tickets solved per day as a heat calendar.
// QueuePage renders it under Next up. Its period control changes the query keys of this panel only.
// A period of 7 days draws a strip of days; 30 and 90 days draw the calendar.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { dayToDate, PERIOD_DAYS, type PeriodDays } from "~/features/helpdesk";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	deskFiguresQueryOptions,
	solvedPerDayQueryOptions,
} from "../api/desk.queries";
import {
	DeskFiguresStrip,
	DeskFiguresStripSkeleton,
} from "./desk-figures-strip";
import { SolvedHeat } from "./solved-heat";

type SolvedCardProps = {
	/** The period of the panel, in days. QueuePage holds it. */
	days: PeriodDays;
	onDaysChange: (days: PeriodDays) => void;
};

// Two columns of cells in a narrow panel, four in one row from a main width of 80rem.
const STRIP_COLUMNS = "grid-cols-2 @7xl/main:grid-cols-4";

/** The header with the period Select, the figures strip, the heat, its two facts, and the legend. */
export function SolvedCard({ days, onDaysChange }: SolvedCardProps) {
	const { t, locale } = useT();
	// keepPreviousData keeps the last period on screen while the next one loads, so the panel does not jump.
	const points = useQuery({
		...solvedPerDayQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const figures = useQuery({
		...deskFiguresQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const number = new Intl.NumberFormat(locale);
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const shortDate = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});

	return (
		<Card className="h-full gap-0 pb-0">
			<CardHeader className="pb-5">
				<CardTitle>{t("chart.solvedTitle")}</CardTitle>
				<CardDescription>{t("chart.solvedDescription")}</CardDescription>
				<CardAction>
					<Select
						value={String(days)}
						onValueChange={(value) =>
							onDaysChange(
								PERIOD_DAYS.find((option) => String(option) === value) ?? days,
							)
						}
					>
						<SelectTrigger aria-label={t("chart.period")} className="w-32">
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							{PERIOD_DAYS.map((option) => (
								<SelectItem key={option} value={String(option)}>
									{dayCount.format(option)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>
			{figures.data ? (
				<DeskFiguresStrip figures={figures.data} className={STRIP_COLUMNS} />
			) : (
				<DeskFiguresStripSkeleton className={STRIP_COLUMNS} />
			)}
			<CardContent className="grid flex-1 content-start gap-4 py-6">
				{points.isError || figures.isError ? (
					<div className="grid justify-items-start gap-3">
						<p role="alert" className="text-sm">
							{t("chart.loadError")}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => {
								void points.refetch();
								void figures.refetch();
							}}
						>
							{t("common.retry")}
						</Button>
					</div>
				) : points.data ? (
					<SolvedHeat
						points={points.data}
						days={days}
						cellTitle={(point) =>
							`${shortDate.format(dayToDate(point.day))}: ${number.format(point.current)}`
						}
					/>
				) : (
					<Skeleton className="h-36 w-full" />
				)}
			</CardContent>
		</Card>
	);
}
