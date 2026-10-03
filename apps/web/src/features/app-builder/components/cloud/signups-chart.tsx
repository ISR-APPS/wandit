/**
 * Bar chart of the sign-ups per UTC day of the last 30 days, as inline SVG.
 * No chart library (WANDIT-188). Pure presentation: users-panel.tsx passes
 * the days of cloudSignupsQuery.
 */

import type { CloudSignupsResponse } from "@wandit/contracts";

import { formatDate, formatNumber, useTranslation } from "@/lib/i18n";

/** Props of SignupsChart. */
export type SignupsChartProps = {
	/** One entry per UTC day, oldest first, from `GET cloud/auth/signups`. */
	days: CloudSignupsResponse["days"];
};

// Units of the SVG viewBox. The SVG stretches to the panel width, so only
// the ratios count: each day gets 10 units, the bar 8, and the gap 2.
const DAY_WIDTH = 10;
const BAR_WIDTH = 8;
const CHART_HEIGHT = 100;
// A day without sign-ups keeps a 2-unit stub on the baseline, so all 30 days show.
const EMPTY_DAY_HEIGHT = 2;

// The days are UTC dates. In the local time zone, "2026-10-03" can show as October 2.
const DAY_FORMAT = {
	dateStyle: "medium",
	timeZone: "UTC",
} as const satisfies Intl.DateTimeFormatOptions;

/** One bar per day, scaled so that the busiest day fills the chart. Each bar has a native tooltip. */
export function SignupsChart({ days }: SignupsChartProps) {
	const { t, locale } = useTranslation();
	// The busiest day fills the chart. A floor of 1 keeps an empty month off a division by zero.
	const busiestDay = Math.max(1, ...days.map((day) => day.count));
	const firstDay = days[0];
	const lastDay = days.at(-1);

	return (
		// The time axis runs left to right in every locale, so the date labels stay under their bars.
		<figure dir="ltr" className="flex flex-col gap-1.5">
			<svg
				viewBox={`0 0 ${days.length * DAY_WIDTH} ${CHART_HEIGHT}`}
				preserveAspectRatio="none"
				role="img"
				aria-label={t("workspace.cloud.users.signups.chartLabel")}
				className="h-28 w-full"
			>
				{days.map((day, index) => {
					const height =
						day.count === 0
							? EMPTY_DAY_HEIGHT
							: (day.count / busiestDay) * CHART_HEIGHT;
					return (
						<g key={day.date}>
							<title>
								{t("workspace.cloud.users.signups.day", {
									date: formatDate(day.date, locale, DAY_FORMAT),
									count: formatNumber(day.count, locale),
								})}
							</title>
							{/* The hover target is the whole day column, so a short bar is easy to point at. */}
							<rect
								x={index * DAY_WIDTH}
								y={0}
								width={DAY_WIDTH}
								height={CHART_HEIGHT}
								className="fill-transparent"
							/>
							<rect
								data-testid="signup-bar"
								x={index * DAY_WIDTH + (DAY_WIDTH - BAR_WIDTH) / 2}
								y={CHART_HEIGHT - height}
								width={BAR_WIDTH}
								height={height}
								className={
									day.count === 0 ? "fill-muted-foreground/30" : "fill-primary"
								}
							/>
						</g>
					);
				})}
			</svg>
			{firstDay && lastDay ? (
				<figcaption className="flex justify-between text-muted-foreground text-xs">
					<span>{formatDate(firstDay.date, locale, DAY_FORMAT)}</span>
					<span>{formatDate(lastDay.date, locale, DAY_FORMAT)}</span>
				</figcaption>
			) : null}
		</figure>
	);
}
