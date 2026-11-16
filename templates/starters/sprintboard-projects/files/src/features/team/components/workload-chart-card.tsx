// The workload chart of the Team page: one horizontal bar per person, split into To do, In progress, and In review points.
// A gray track fills each bar up to the capacity of the person, and the load percent sits at the bar end.
// TeamPage renders it beside the table on wide screens, above it on narrow screens. The rows come sorted by load.
import {
	Bar,
	BarChart,
	CartesianGrid,
	LabelList,
	XAxis,
	YAxis,
} from "recharts";
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
import type { WorkloadRow } from "../lib/workload";

type WorkloadChartCardProps = {
	/** One row per person, the highest load first. */
	rows: WorkloadRow[];
};

// The legend marks, in the order of the stack. The swatch classes match the colors of the config.
const LEGEND = [
	{ key: "reviewPoints", swatch: "bg-chart-4" },
	{ key: "progressPoints", swatch: "bg-chart-1" },
	{ key: "todoPoints", swatch: "bg-chart-5" },
	{ key: "freePoints", swatch: "bg-muted ring-1 ring-border ring-inset" },
] as const;

// Each person takes a band of at least 2.5rem, so the names never overlap.
// The plot grows to the height of the table beside it, so the two panels end on one line.
const ROW_REM = 2.5;

/** Bars are stacked by status. The tooltip gives the points of each status. Over capacity, the percent is red. */
export function WorkloadChartCard({ rows }: WorkloadChartCardProps) {
	const { t, locale, dir } = useT();
	const isRtl = dir === "rtl";
	const config = {
		reviewPoints: { label: t("status.in-review"), color: "var(--chart-4)" },
		progressPoints: { label: t("status.in-progress"), color: "var(--chart-1)" },
		todoPoints: { label: t("status.todo"), color: "var(--chart-5)" },
		freePoints: { label: t("team.freeCapacity"), color: "var(--muted)" },
	} satisfies ChartConfig;
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const data = rows.map((row) => ({
		name: row.member.name,
		reviewPoints: row.reviewPoints,
		progressPoints: row.progressPoints,
		todoPoints: row.todoPoints,
		// The track ends at the capacity. A person over capacity has no track.
		freePoints: Math.max(row.member.capacity - row.committedPoints, 0),
		// One of the two labels shows per row, so an over-capacity load can have its own color.
		loadLabel: row.load > 1 ? undefined : percent.format(row.load),
		overLabel: row.load > 1 ? percent.format(row.load) : undefined,
	}));
	const top = rows[0];
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("team.chartTitle")}</CardTitle>
				<CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
					{LEGEND.map((entry) => (
						<span key={entry.key} className="flex items-center gap-1.5">
							<span
								aria-hidden="true"
								className={`size-2.5 rounded-sm ${entry.swatch}`}
							/>
							{config[entry.key].label}
						</span>
					))}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				<ChartContainer
					config={config}
					className="aspect-auto w-full flex-1"
					style={{ minHeight: `${rows.length * ROW_REM + 2}rem` }}
					role="img"
					aria-label={
						top
							? `${t("team.chartTitle")}. ${top.member.name}: ${number.format(top.committedPoints)} ${t("task.pointsShort")}`
							: t("team.chartTitle")
					}
				>
					<BarChart
						data={data}
						layout="vertical"
						// The space on the end side holds the load label of the longest bar.
						margin={{
							top: 0,
							bottom: 0,
							left: isRtl ? 48 : 0,
							right: isRtl ? 0 : 48,
						}}
						barCategoryGap={6}
					>
						<CartesianGrid horizontal={false} />
						<XAxis
							type="number"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							allowDecimals={false}
							reversed={isRtl}
							tickFormatter={(value: number) => number.format(value)}
						/>
						<YAxis
							type="category"
							dataKey="name"
							width="auto"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							orientation={isRtl ? "right" : "left"}
							tick={{ textAnchor: "end" }}
						/>
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent indicator="dot" />}
						/>
						<Bar
							dataKey="reviewPoints"
							stackId="load"
							fill="var(--color-reviewPoints)"
							isAnimationActive={false}
						/>
						<Bar
							dataKey="progressPoints"
							stackId="load"
							fill="var(--color-progressPoints)"
							isAnimationActive={false}
						/>
						<Bar
							dataKey="todoPoints"
							stackId="load"
							fill="var(--color-todoPoints)"
							isAnimationActive={false}
						/>
						{/* Recharts drops a bar of width 0 with its labels. minPointSize keeps 1 px, so an over-capacity row keeps its label. */}
						<Bar
							dataKey="freePoints"
							stackId="load"
							fill="var(--color-freePoints)"
							minPointSize={1}
							isAnimationActive={false}
						>
							<LabelList
								dataKey="loadLabel"
								position={isRtl ? "left" : "right"}
								fill="var(--muted-foreground)"
								className="text-xs tabular-nums"
							/>
							<LabelList
								dataKey="overLabel"
								position={isRtl ? "left" : "right"}
								fill="var(--destructive)"
								className="font-semibold text-xs tabular-nums"
							/>
						</Bar>
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
