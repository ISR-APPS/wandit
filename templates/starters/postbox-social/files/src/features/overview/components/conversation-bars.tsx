// The stacked bars of the conversation card: likes at the base, conversations on top, one bar per week.
// ConversationCard loads this file with React.lazy, so the chart library stays out of the first script.
import { Bar, BarChart, XAxis } from "recharts";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { ConversationWeek } from "../api/overview.queries";

type ConversationBarsProps = {
	/** Six weeks, oldest first. */
	weeks: ConversationWeek[];
	/** The translated series names. */
	likesLabel: string;
	conversationsLabel: string;
};

/** The screen reader text lists each week with its two counts. */
export function ConversationBars({
	weeks,
	likesLabel,
	conversationsLabel,
}: ConversationBarsProps) {
	const { locale, dir } = useT();
	const number = new Intl.NumberFormat(locale);
	// The week key is a calendar day. UTC keeps the same day in every time zone.
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const data = weeks.map((week) => ({
		week: dayFormat.format(new Date(`${week.start}T00:00:00Z`)),
		likes: week.likes,
		conversations: week.conversations,
	}));
	const chartConfig = {
		likes: { label: likesLabel, color: "var(--chart-1)" },
		conversations: { label: conversationsLabel, color: "var(--chart-2)" },
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-36 w-full"
			role="img"
			aria-label={data
				.map(
					(point) =>
						`${point.week}: ${likesLabel} ${number.format(point.likes)}, ${conversationsLabel} ${number.format(point.conversations)}`,
				)
				.join("; ")}
		>
			<BarChart data={data} margin={{ left: 0, right: 0, top: 4 }}>
				<XAxis
					dataKey="week"
					reversed={dir === "rtl"}
					tickLine={false}
					axisLine={false}
					tickMargin={10}
				/>
				<ChartTooltip cursor={false} content={<ChartTooltipContent />} />
				{/* The base bar rounds its foot and the top bar rounds its head, so the stack reads as one bar. */}
				<Bar
					dataKey="likes"
					stackId="week"
					fill="var(--color-likes)"
					radius={[0, 0, 6, 6]}
					maxBarSize={48}
					isAnimationActive={false}
				/>
				<Bar
					dataKey="conversations"
					stackId="week"
					fill="var(--color-conversations)"
					radius={[6, 6, 0, 0]}
					maxBarSize={48}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}
