// The source breakdown of the leads page: a donut of the leads of the last 30 days, with the total in its hole.
// LeadsPage renders it with the slices of buildSourceSlices(). The parts list under the donut names each color.
import { Cell, Pie, PieChart } from "recharts";
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
import type { SourceSlice } from "../lib/lead-stats";

// The slice colors, the largest part first. The part "other" is always muted.
const SLICE_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
] as const;
const OTHER_COLOR = "var(--muted-foreground)";

type SourcesCardProps = {
	/** The sources of the leads of the last 30 days, the largest first, with "other" last. */
	slices: SourceSlice[];
};

/** A total of 0 draws one muted ring, because the chart library draws no slice for a sum of 0. */
export function SourcesCard({ slices }: SourcesCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	const parts = slices.map((slice, index) => ({
		...slice,
		label: t(`agency.leadSources.${slice.source}`),
		color:
			slice.source === "other"
				? OTHER_COLOR
				: (SLICE_COLORS[index] ?? OTHER_COLOR),
	}));
	const config = Object.fromEntries(
		parts.map((part) => [
			part.source,
			{ label: part.label, color: part.color },
		]),
	) satisfies ChartConfig;
	const ariaLabel = [
		t("leads.sourcesTitle"),
		...parts.map((part) => `${part.label}: ${number.format(part.value)}`),
		`${t("chart.total")}: ${number.format(total)}`,
	].join(", ");

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("leads.sourcesTitle")}</CardTitle>
				<CardDescription>{t("leads.sourcesDescription")}</CardDescription>
			</CardHeader>
			{/* From 42rem to 56rem the card spans the page: the donut sits at the start, the legend at the end. */}
			<CardContent className="grid @2xl/main:grid-cols-[auto_minmax(0,1fr)] @4xl/main:grid-cols-1 items-center @2xl/main:gap-10 @4xl/main:gap-5 gap-5">
				<div className="relative mx-auto aspect-square h-44">
					<ChartContainer
						config={config}
						className="aspect-square h-44"
						role="img"
						aria-label={ariaLabel}
					>
						<PieChart>
							{total === 0 ? null : (
								<ChartTooltip
									cursor={false}
									content={<ChartTooltipContent hideLabel />}
								/>
							)}
							<Pie
								data={
									total === 0
										? [{ source: "none", value: 1, color: "var(--muted)" }]
										: parts
								}
								dataKey="value"
								nameKey="source"
								innerRadius="62%"
								outerRadius="100%"
								// A line in the panel color splits the slices.
								stroke="var(--card)"
								isAnimationActive={false}
							>
								{(total === 0
									? [{ source: "none", color: "var(--muted)" }]
									: parts
								).map((part) => (
									<Cell key={part.source} fill={part.color} />
								))}
							</Pie>
						</PieChart>
					</ChartContainer>
					<div className="pointer-events-none absolute inset-0 grid place-content-center justify-items-center">
						<span className="font-numeric text-3xl tabular-nums leading-none">
							{number.format(total)}
						</span>
						<span className="text-muted-foreground text-xs">
							{t("chart.total")}
						</span>
					</div>
				</div>
				{total === 0 ? (
					<p className="text-center text-muted-foreground text-sm">
						{t("chart.empty")}
					</p>
				) : (
					<ul className="grid grid-cols-2 gap-x-6 gap-y-2">
						{parts.map((part) => (
							<li key={part.source} className="flex items-center gap-2 text-sm">
								<span
									aria-hidden="true"
									className="size-2.5 shrink-0 rounded-full"
									// The mark has the color of its slice, a chart token.
									style={{ backgroundColor: part.color }}
								/>
								<span className="truncate">{part.label}</span>
								<span className="ms-auto tabular-nums">
									{number.format(part.value)}
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
