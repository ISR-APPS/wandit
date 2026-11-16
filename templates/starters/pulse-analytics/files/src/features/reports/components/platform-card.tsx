// The platform card of the Reports page: the active people of the last 30 days by platform, as a donut and a list.
// ReportsPage renders it with the rows of the platform query. It follows the breakdown part of the chart form "area".
import { Pie, PieChart } from "recharts";
import {
	fillMessage,
	PLATFORMS,
	type Platform,
	shareFormat,
	wholeShares,
} from "~/features/tracking";
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

type PlatformCardProps = {
	/** The active people per platform, the largest first. */
	platforms: { platform: Platform; people: number }[];
};

/** Each person has one platform, so the total in the hole is the active people of the period. */
export function PlatformCard({ platforms }: PlatformCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share = shareFormat(locale);
	const total = platforms.reduce((sum, row) => sum + row.people, 0);
	const shares = wholeShares(platforms.map((row) => row.people));
	// Recharts reads the color of each slice from its `fill` field.
	// The color follows the place in PLATFORMS, not the rank, so a platform keeps its color in every period.
	const slices = platforms.map((row, index) => ({
		platform: row.platform,
		label: t(`platforms.${row.platform}`),
		value: row.people,
		share: shares[index] ?? 0,
		fill: `var(--chart-${PLATFORMS.indexOf(row.platform) + 1})`,
	}));
	const chartConfig = Object.fromEntries(
		slices.map((slice) => [slice.label, { label: slice.label }]),
	) satisfies ChartConfig;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("reports.platforms.title")}</CardTitle>
				<CardDescription>{t("reports.platforms.description")}</CardDescription>
			</CardHeader>
			<CardContent className="grid flex-1 content-center gap-6">
				<div className="relative mx-auto aspect-square h-52">
					<ChartContainer
						config={chartConfig}
						className="aspect-square h-full"
						role="img"
						aria-label={fillMessage(t("reports.platforms.label"), {
							parts: slices
								.map((slice) => `${slice.label} ${number.format(slice.value)}`)
								.join(", "),
						})}
					>
						<PieChart>
							{total === 0 ? null : (
								<ChartTooltip
									cursor={false}
									content={<ChartTooltipContent hideLabel />}
								/>
							)}
							<Pie
								// Recharts draws no sector when the sum is 0, so an empty period gets one muted ring.
								data={
									total === 0
										? [{ label: "", value: 1, fill: "var(--muted)" }]
										: slices
								}
								dataKey="value"
								nameKey="label"
								innerRadius="62%"
								outerRadius="100%"
								stroke="var(--card)"
								isAnimationActive={false}
							/>
						</PieChart>
					</ChartContainer>
					<div className="pointer-events-none absolute inset-0 grid content-center justify-items-center gap-1">
						<span className="font-numeric font-semibold text-2xl tabular-nums leading-none">
							{number.format(total)}
						</span>
						<span className="text-muted-foreground text-xs">
							{t("reports.platforms.total")}
						</span>
					</div>
				</div>
				<ul className="grid grid-cols-2 gap-x-6 gap-y-3">
					{slices.map((slice) => (
						<li key={slice.platform} className="grid gap-1">
							<span className="flex items-center gap-2 text-muted-foreground text-xs">
								<span
									aria-hidden="true"
									className="size-2 shrink-0 rounded-badge"
									style={{ backgroundColor: slice.fill }}
								/>
								{slice.label}
							</span>
							<span className="flex items-baseline gap-2">
								<span className="font-numeric font-semibold tabular-nums leading-none">
									{number.format(slice.value)}
								</span>
								<span className="text-muted-foreground text-xs tabular-nums">
									{share.format(slice.share)}
								</span>
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
