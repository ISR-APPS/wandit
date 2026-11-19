// The bar spark of the sign-ups card: the new members of each of the last 8 weeks, with the count on each bar.
// SignUpsCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows recipe 3.8 of the kit system, bar variant: one bar series, radius 2, value labels on top.
import { Bar, BarChart, LabelList, XAxis } from "recharts";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { SignUpWeek } from "../lib/summary";

type SignUpsBarsProps = {
	/** The weeks, oldest first. The last one ends now. */
	weeks: SignUpWeek[];
};

/** The card text gives the total, so the bars are hidden from screen readers. */
export function SignUpsBars({ weeks }: SignUpsBarsProps) {
	const { t, locale, dir } = useT();
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const chartConfig = {
		count: { label: t("dashboard.signUpsTitle"), color: "var(--chart-1)" },
	} satisfies ChartConfig;
	const data = weeks.map((week) => ({
		key: dayFormat.format(week.endsAt),
		count: week.count,
	}));
	return (
		<ChartContainer
			config={chartConfig}
			aria-hidden="true"
			className="aspect-auto min-h-36 w-full flex-1"
		>
			{/* The top margin leaves room for the labels over the highest bar. */}
			<BarChart data={data} margin={{ top: 20, right: 0, bottom: 0, left: 0 }}>
				<XAxis dataKey="key" hide reversed={dir === "rtl"} />
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(key) =>
								`${t("dashboard.weekTo")} ${String(key)}`
							}
						/>
					}
				/>
				<Bar
					dataKey="count"
					fill="var(--color-count)"
					radius={2}
					isAnimationActive={false}
				>
					<LabelList
						dataKey="count"
						position="top"
						className="fill-foreground text-xs"
					/>
				</Bar>
			</BarChart>
		</ChartContainer>
	);
}
