// The attendance panel of the member page: the visits of 30 days, and the visits per week as bars.
// MemberDetailPage renders it with the attendance windows of memberQueryOptions.
// A week with no visit is a real 0. A member with no visit at all sees the empty frame with one sentence.
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useT } from "~/shared/i18n";
import {
	Card,
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
import { type AppThemeFile, useAppTheme } from "~/styles/theme";
import type { AttendanceWeek } from "../lib/member-rows";

type MemberAttendanceCardProps = {
	/** 7-day windows, oldest first. The last one ends today. */
	weeks: AttendanceWeek[];
	/** Check-ins in the last 30 days. */
	visitsInWindow: number;
	/** The visits per week that the member usually makes, from the member row. */
	usualPerWeek: number;
};

/** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
const BAR_RADIUS_PX = {
	none: 0,
	sm: 2,
	md: 2,
	lg: 4,
	xl: 4,
} satisfies Record<AppThemeFile["selection"]["radius"], number>;

/** The Y axis gives the visits of a week. The tooltip names the week. */
export function MemberAttendanceCard({
	weeks,
	visitsInWindow,
	usualPerWeek,
}: MemberAttendanceCardProps) {
	const { t, locale, dir } = useT();
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const number = new Intl.NumberFormat(locale);
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const chartConfig = {
		visits: { label: t("members.visits"), color: "var(--chart-1)" },
	} satisfies ChartConfig;
	const data = weeks.map((week) => ({
		week: week.weekStart,
		visits: week.visits,
	}));
	const isEmpty = weeks.every((week) => week.visits === 0);
	const isRtl = dir === "rtl";
	const last = weeks.at(-1);
	const label = `${t("members.attendance")}: ${last ? number.format(last.visits) : 0} ${t("members.visitsThisWeek")}`;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("members.attendance")}</CardTitle>
				<CardDescription>{t("members.attendanceDescription")}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				<dl className="flex flex-wrap gap-x-10 gap-y-3">
					<div className="grid gap-1">
						<dt className="label-text text-muted-foreground text-xs">
							{t("members.visits30")}
						</dt>
						<dd className="font-numeric text-3xl tabular-nums">
							{number.format(visitsInWindow)}
						</dd>
					</div>
					<div className="grid gap-1">
						<dt className="label-text text-muted-foreground text-xs">
							{t("members.usualVisits")}
						</dt>
						<dd className="font-numeric text-3xl tabular-nums">
							{number.format(usualPerWeek)}
							<span className="ms-1 font-sans text-muted-foreground text-sm">
								{t("members.perWeek")}
							</span>
						</dd>
					</div>
				</dl>
				<div className="relative">
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-44 w-full"
						role="img"
						aria-label={label}
					>
						<BarChart data={data} margin={{ top: 4, left: 0, right: 0 }}>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="week"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								minTickGap={16}
								reversed={isRtl}
								tickFormatter={(value: number) => dayFormat.format(value)}
							/>
							{/* SVG anchors follow the page direction. "end" puts the text end at the plot side in LTR and RTL. */}
							<YAxis
								hide={isEmpty}
								orientation={isRtl ? "right" : "left"}
								tick={{ textAnchor: "end" }}
								width="auto"
								allowDecimals={false}
								tickLine={false}
								axisLine={false}
								tickMargin={8}
							/>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										labelFormatter={(value) =>
											`${t("members.weekOf")} ${dayFormat.format(Number(value))}`
										}
									/>
								}
							/>
							<Bar
								dataKey="visits"
								fill="var(--color-visits)"
								radius={[barRadius, barRadius, 0, 0]}
								isAnimationActive={false}
							/>
						</BarChart>
					</ChartContainer>
					{isEmpty ? (
						<p className="absolute inset-0 grid place-content-center text-muted-foreground text-sm">
							{t("members.noAttendance")}
						</p>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}
