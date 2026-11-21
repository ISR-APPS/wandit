// The donut of the activation card: the new users of the period that are activated, and the others.
// ActivationCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// The hole shows the activation rate and a caption, 24 px under it.
import { Label, Pie, PieChart } from "recharts";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

type ActivationDonutProps = {
	/** New users that completed a first task. */
	activated: number;
	/** New users that did not. */
	notActivated: number;
};

/** No new user draws one muted ring with no tooltip, because recharts draws no sector for a sum of 0. */
export function ActivationDonut({
	activated,
	notActivated,
}: ActivationDonutProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const total = activated + notActivated;
	const chartConfig = {
		activated: {
			label: t("overview.activation.activated"),
			color: "var(--chart-1)",
		},
		notActivated: {
			label: t("overview.activation.notActivated"),
			color: "var(--chart-2)",
		},
	} satisfies ChartConfig;
	const data =
		total === 0
			? [{ key: "none", value: 1, fill: "var(--muted)" }]
			: [
					{
						key: "activated",
						value: activated,
						fill: "var(--color-activated)",
					},
					{
						key: "notActivated",
						value: notActivated,
						fill: "var(--color-notActivated)",
					},
				];

	return (
		<ChartContainer
			config={chartConfig}
			className="mx-auto aspect-square h-64"
			role="img"
			aria-label={`${t("overview.activation.activated")} ${number.format(activated)}, ${t("overview.activation.notActivated")} ${number.format(notActivated)}`}
		>
			<PieChart>
				{total === 0 ? null : (
					<ChartTooltip
						cursor={false}
						content={<ChartTooltipContent hideLabel />}
					/>
				)}
				<Pie
					data={data}
					dataKey="value"
					nameKey="key"
					innerRadius="62%"
					outerRadius="100%"
					stroke="var(--card)"
					strokeWidth={2}
					isAnimationActive={false}
				>
					<Label
						content={({ viewBox }) =>
							viewBox && "cx" in viewBox && "cy" in viewBox ? (
								<text
									x={viewBox.cx}
									y={viewBox.cy}
									textAnchor="middle"
									dominantBaseline="middle"
								>
									<tspan
										x={viewBox.cx}
										y={viewBox.cy}
										className="fill-foreground font-numeric font-semibold text-3xl"
									>
										{total === 0 ? "–" : percent.format(activated / total)}
									</tspan>
									<tspan
										x={viewBox.cx}
										y={(viewBox.cy ?? 0) + 24}
										className="fill-muted-foreground text-sm"
									>
										{t("overview.activation.activated")}
									</tspan>
								</text>
							) : null
						}
					/>
				</Pie>
			</PieChart>
		</ChartContainer>
	);
}
