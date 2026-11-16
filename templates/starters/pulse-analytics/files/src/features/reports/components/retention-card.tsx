// The retention card of the Reports page: one row per sign-up week, one cell per later week, colored by the share that came back.
// ReportsPage renders it with the weeks of the retention query. A control switches the cells between shares and people.
// Under 1024 px the table shows the first PHONE_WEEKS later weeks and a line that names the others.
import { useState } from "react";
import {
	dayToDate,
	fillMessage,
	STACKING_ACTION,
	STACKING_HEADER,
	shareOf,
	TAB_TOUCH_AREA,
	useIsWideScreen,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { RETENTION_WEEKS, type RetentionCohort } from "../api/reports.queries";

/** The two views of a cell: the share of the sign-up week, or the count of people. */
const CELL_VIEWS = ["share", "people"] as const;
type CellView = (typeof CELL_VIEWS)[number];

/** The later weeks that fit beside the week and the users columns at 390 px. */
const PHONE_WEEKS = 4;

/**
 * The 5 color steps of a cell, from the lowest share of the table to the highest. The only hue is `--chart-1`.
 * The text keeps a contrast of 4.5:1 on each step: the last step is a full fill, so it takes the light text.
 */
const HEAT_STEPS = [
	"bg-[color-mix(in_oklab,var(--chart-1)_10%,var(--card))]",
	"bg-[color-mix(in_oklab,var(--chart-1)_25%,var(--card))]",
	"bg-[color-mix(in_oklab,var(--chart-1)_40%,var(--card))]",
	"bg-[color-mix(in_oklab,var(--chart-1)_60%,var(--card))]",
	"bg-chart-1 text-primary-foreground",
] as const;

// The step of a share between the lowest and the highest share of the table: 0 to 4, an index of HEAT_STEPS.
function heatStep(share: number, lowest: number, highest: number): number {
	if (highest <= lowest) {
		return 0;
	}
	const place = (share - lowest) / (highest - lowest);
	return Math.min(HEAT_STEPS.length - 1, Math.floor(place * HEAT_STEPS.length));
}

type RetentionCardProps = {
	/** The sign-up weeks, the oldest first. */
	cohorts: RetentionCohort[];
};

/** A cell is empty while its week is not complete for every person of the row. The last row is the average of each column. */
export function RetentionCard({ cohorts }: RetentionCardProps) {
	const { t, locale } = useT();
	const isWide = useIsWideScreen();
	const [view, setView] = useState<CellView>("share");
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const formatDay = (day: string) => dayFormat.format(dayToDate(day));
	const weekNumbers = Array.from(
		{ length: isWide ? RETENTION_WEEKS : PHONE_WEEKS },
		(_, index) => index + 1,
	);

	// The colors use every week, so a cell keeps its color on a phone.
	const shares = cohorts.flatMap((cohort) =>
		cohort.retained.flatMap((people) =>
			people === null ? [] : [shareOf(people, cohort.size)],
		),
	);
	const lowest = Math.min(...shares);
	const highest = Math.max(...shares);
	// Per later week, over the rows that have the week: the people that came back, their sign-ups, and the row count.
	// The share view divides the people by the sign-ups. The people view divides the people by the rows.
	const averages = weekNumbers.map((_, index) => {
		const complete = cohorts.filter((cohort) => cohort.retained[index] != null);
		return {
			people: complete.reduce(
				(sum, cohort) => sum + (cohort.retained[index] ?? 0),
				0,
			),
			size: complete.reduce((sum, cohort) => sum + cohort.size, 0),
			rows: complete.length,
		};
	});

	return (
		<Card>
			<CardHeader className={STACKING_HEADER}>
				<CardTitle>{t("reports.retention.title")}</CardTitle>
				<CardDescription>{t("reports.retention.description")}</CardDescription>
				<CardAction className={STACKING_ACTION}>
					<Tabs
						value={view}
						onValueChange={(value) =>
							setView(CELL_VIEWS.find((option) => option === value) ?? "share")
						}
					>
						<TabsList aria-label={t("reports.retention.view")}>
							{CELL_VIEWS.map((option) => (
								<TabsTrigger
									key={option}
									value={option}
									className={cn("px-3", TAB_TOUCH_AREA)}
								>
									{t(`reports.retention.views.${option}`)}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-5">
				{/* The table scrolls inside the card on a phone, so the page keeps its width. */}
				<div className="overflow-x-auto">
					<table className="w-full border-separate border-spacing-1 text-sm">
						<thead>
							<tr className="label-text text-muted-foreground text-xs">
								<th scope="col" className="pe-3 pb-1 text-start font-medium">
									{t(
										isWide
											? "reports.retention.signUpWeek"
											: "reports.retention.weekOf",
									)}
								</th>
								<th scope="col" className="pe-3 pb-1 text-end font-medium">
									{t("reports.retention.people")}
								</th>
								{weekNumbers.map((week) => (
									<th
										key={week}
										scope="col"
										className="@xl/main:min-w-12 min-w-10 pb-1 text-center font-medium"
									>
										{fillMessage(t("reports.retention.week"), {
											number: number.format(week),
										})}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{cohorts.map((cohort) => (
								<tr key={cohort.id}>
									<th
										scope="row"
										className="whitespace-nowrap pe-3 text-start font-normal"
									>
										{isWide
											? `${formatDay(cohort.id)} – ${formatDay(cohort.lastDay)}`
											: formatDay(cohort.id)}
									</th>
									<td className="pe-3 text-end font-medium tabular-nums">
										{number.format(cohort.size)}
									</td>
									{weekNumbers.map((week, index) => {
										const people = cohort.retained[index] ?? null;
										if (people === null) {
											// A week that is not complete yet keeps its place as an empty cell.
											return (
												<td key={week} className="h-9 rounded-sm bg-muted/50" />
											);
										}
										const share = shareOf(people, cohort.size);
										return (
											<td
												key={week}
												className={cn(
													"h-9 rounded-sm text-center text-xs tabular-nums",
													HEAT_STEPS[heatStep(share, lowest, highest)],
												)}
											>
												{view === "share"
													? percent.format(share)
													: number.format(people)}
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
						<tfoot>
							<tr className="text-muted-foreground">
								<th scope="row" className="pe-3 pt-1 text-start font-medium">
									{t("reports.retention.average")}
								</th>
								<td />
								{weekNumbers.map((week, index) => {
									const average = averages[index];
									return (
										<td
											key={week}
											className="pt-1 text-center font-medium text-foreground text-xs tabular-nums"
										>
											{average && average.size > 0
												? view === "share"
													? percent.format(
															shareOf(average.people, average.size),
														)
													: number.format(
															Math.round(average.people / average.rows),
														)
												: null}
										</td>
									);
								})}
							</tr>
						</tfoot>
					</table>
				</div>
				<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-muted-foreground text-xs">
					<p>
						{t("reports.retention.incomplete")}
						{isWide
							? null
							: ` ${fillMessage(t("reports.retention.moreWeeks"), {
									from: number.format(PHONE_WEEKS + 1),
									to: number.format(RETENTION_WEEKS),
								})}`}
					</p>
					<div aria-hidden="true" className="flex items-center gap-1.5">
						<span>{t("reports.retention.less")}</span>
						{HEAT_STEPS.map((step) => (
							<span key={step} className={cn("size-3.5 rounded-xs", step)} />
						))}
						<span>{t("reports.retention.more")}</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
