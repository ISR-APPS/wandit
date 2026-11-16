// The trend card of picked units: one bar per day, with a "Per day" and a "Running total" view.
// The home renders it as its main chart; the item page renders it for one item.
// It takes the points from buildDailyPicks. The period Select shows only when the caller passes onDaysChange.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { type AppThemeFile, useAppTheme } from "~/styles/theme";
import { type DailyPoint, PERIOD_DAYS, type PeriodDays } from "../lib/series";

/** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
const BAR_RADIUS_PX = { none: 0, sm: 2, md: 2, lg: 4, xl: 4 } satisfies Record<
	AppThemeFile["selection"]["radius"],
	number
>;

type DailyUnitsCardProps = {
	/** The card title, already translated. */
	title: string;
	/** One muted line under the title, already translated. */
	description?: string;
	/** One point per day, oldest first. */
	points: DailyPoint[];
	/** The period of `points`, in days. */
	days: PeriodDays;
	/** Shows the period Select. The caller changes the query key with the new period. */
	onDaysChange?: (days: PeriodDays) => void;
	/** "main" for the home chart (h-72), "side" for the item page (h-52). */
	height?: "main" | "side";
};

/** The view of the plot. Both views show the same picks. */
type View = "perDay" | "runningTotal";

/** A Card with the header, the view tabs, and the plot. An all-zero period keeps the frame and shows one sentence. */
export function DailyUnitsCard({
	title,
	description,
	points,
	days,
	onDaysChange,
	height = "main",
}: DailyUnitsCardProps) {
	const { t, locale, dir } = useT();
	const [view, setView] = useState<View>("perDay");
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];

	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	// Midnight UTC, shown in UTC, keeps the same calendar day in every time zone.
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const formatDay = (day: string | number) =>
		dayFormat.format(new Date(`${day}T00:00:00Z`));
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 0,
	});
	const dayUnit = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});

	let runningTotal = 0;
	const data = points.map((point) => {
		runningTotal += point.current;
		return {
			day: point.day,
			value: view === "perDay" ? point.current : runningTotal,
		};
	});
	const isEmpty = points.every((point) => point.current === 0);
	const config = {
		value: {
			label: t(view === "perDay" ? "chart.unitsPicked" : "chart.runningTotal"),
			color: "var(--chart-1)",
		},
	} satisfies ChartConfig;

	// The label names the last day, its value, and its change against the same day one period earlier.
	const last = points.at(-1);
	const ariaParts = [title];
	if (last) {
		ariaParts.push(`${formatDay(last.day)}: ${number.format(last.current)}`);
		if (last.previous > 0) {
			ariaParts.push(
				`${percent.format((last.current - last.previous) / last.previous)} ${t("chart.vsPrevious")}`,
			);
		}
	}

	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				{description ? <CardDescription>{description}</CardDescription> : null}
				{onDaysChange ? (
					<CardAction>
						<Select
							value={String(days)}
							onValueChange={(value) =>
								onDaysChange(
									PERIOD_DAYS.find((option) => String(option) === value) ??
										days,
								)
							}
						>
							<SelectTrigger aria-label={t("chart.period")} className="w-32">
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
				) : null}
			</CardHeader>
			<CardContent className="grid gap-4">
				<Tabs
					value={view}
					onValueChange={(value) =>
						setView(value === "runningTotal" ? "runningTotal" : "perDay")
					}
				>
					<TabsList>
						<TabsTrigger value="perDay">{t("chart.perDay")}</TabsTrigger>
						<TabsTrigger value="runningTotal">
							{t("chart.runningTotal")}
						</TabsTrigger>
					</TabsList>
				</Tabs>
				<div className="relative">
					<ChartContainer
						config={config}
						role="img"
						aria-label={ariaParts.join(". ")}
						className={
							height === "main"
								? "aspect-auto @3xl/main:h-72 h-64 w-full"
								: "aspect-auto h-52 w-full"
						}
					>
						<BarChart
							data={data}
							margin={
								dir === "rtl"
									? { top: 4, left: 4, right: 8 }
									: { top: 4, left: 0, right: 4 }
							}
						>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="day"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								minTickGap={24}
								reversed={dir === "rtl"}
								tickFormatter={formatDay}
							/>
							{isEmpty ? null : (
								<YAxis
									width="auto"
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									// Units are whole: a slow item must not show a tick of 0.5.
									allowDecimals={false}
									orientation={dir === "rtl" ? "right" : "left"}
									tick={{ textAnchor: "end" }}
									tickFormatter={(value: number) => compact.format(value)}
								/>
							)}
							<ChartTooltip
								cursor={false}
								content={<ChartTooltipContent labelFormatter={formatDay} />}
							/>
							<Bar
								dataKey="value"
								fill="var(--color-value)"
								radius={[barRadius, barRadius, 0, 0]}
								isAnimationActive={false}
							/>
						</BarChart>
					</ChartContainer>
					{isEmpty ? (
						<div className="absolute inset-0 grid place-content-center justify-items-center gap-2 text-center">
							<p className="text-muted-foreground text-sm">
								{t("chart.empty")}
							</p>
							<Link
								to="/app/items"
								className="font-medium text-sm underline-offset-4 hover:underline"
							>
								{t("chart.emptyAction")}
							</Link>
						</div>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}

/** Placeholder of the card while its query loads: the header, the tabs, and the plot in their final sizes. */
export function DailyUnitsCardSkeleton({
	height = "main",
}: Pick<DailyUnitsCardProps, "height">) {
	return (
		<Card className="gap-4">
			<CardHeader>
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-4 w-56" />
			</CardHeader>
			<CardContent className="grid gap-4">
				<Skeleton className="h-9 w-52" />
				<Skeleton
					className={
						height === "main" ? "@3xl/main:h-72 h-64 w-full" : "h-52 w-full"
					}
				/>
			</CardContent>
		</Card>
	);
}
