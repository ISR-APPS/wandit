import { CircleCheckIcon, CreditCardIcon, RotateCcwIcon } from "lucide-react";
import { Bar, BarChart } from "recharts";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import type {
	OverviewGenerationPoint,
	OverviewGenerationSummary,
} from "@/features/overview/api/overview.dto";
import {
	formatOverviewLatency,
	formatOverviewPercent,
	formatOverviewPercentValue,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";
import { cn } from "@/lib/utils";

type GenerationHealthCardProps = {
	generation: OverviewGenerationSummary;
	points: OverviewGenerationPoint[];
	generatedAt: string;
};

type ActivityTone = "success" | "warning" | "neutral";

const generationChartConfig = {
	successful: {
		label: "Successful",
		color: "var(--chart-1)",
	},
	failed: {
		label: "Failed",
		color: "var(--destructive)",
	},
} satisfies ChartConfig;

const recentSignals = [
	{
		id: "payment",
		title: "Chargily payment captured",
		detail: "Leila Kaci · DZD 6,500",
		offsetMinutes: 4,
		icon: CreditCardIcon,
		tone: "success" as ActivityTone,
	},
	{
		id: "generation",
		title: "Website generated in 42s",
		detail: "Aya Benali · Portfolio launch",
		offsetMinutes: 9,
		icon: CircleCheckIcon,
		tone: "success" as ActivityTone,
	},
	{
		id: "retry",
		title: "Generation retried automatically",
		detail: "Nassim Guerroudj · Asset timeout",
		offsetMinutes: 18,
		icon: RotateCcwIcon,
		tone: "warning" as ActivityTone,
	},
] as const;

const activityToneClasses: Record<ActivityTone, string> = {
	success:
		"border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
	warning:
		"border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
	neutral: "border-border bg-muted text-muted-foreground",
};

function formatPercentagePointDelta(value: number) {
	const sign = value > 0 ? "+" : value < 0 ? "−" : "";
	return `${sign}${Math.abs(value).toFixed(1)} pp`;
}

function getSignalDateTime(generatedAt: string, offsetMinutes: number) {
	const parsedGeneratedAt = Date.parse(generatedAt);
	const safeGeneratedAt = Number.isNaN(parsedGeneratedAt)
		? Date.now()
		: parsedGeneratedAt;

	return new Date(safeGeneratedAt - offsetMinutes * 60_000).toISOString();
}

function GenerationHealthCard({
	generation,
	points,
	generatedAt,
}: GenerationHealthCardProps) {
	const successDelta =
		generation.successRatePercent - generation.previousSuccessRatePercent;
	const latencyDelta =
		generation.previousAverageLatencyMs > 0
			? ((generation.averageLatencyMs - generation.previousAverageLatencyMs) /
					generation.previousAverageLatencyMs) *
				100
			: 0;

	return (
		<Card className="h-full shadow-none">
			<CardHeader className="border-b">
				<div>
					<CardTitle>
						<h2>Generation health</h2>
					</CardTitle>
					<CardDescription className="mt-1">
						Completion quality and recent platform signals
					</CardDescription>
				</div>
				<CardAction>
					<Badge
						variant="outline"
						className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
					>
						<span className="size-1.5 rounded-full bg-current" />
						Operational
					</Badge>
				</CardAction>
			</CardHeader>

			<CardContent className="space-y-5 pt-5">
				<div>
					<div className="flex items-end justify-between gap-4">
						<div>
							<p className="text-muted-foreground text-xs">
								Successful attempts
							</p>
							<p className="mt-1 font-semibold text-3xl tabular-nums tracking-tight">
								{formatOverviewPercentValue(generation.successRatePercent)}
							</p>
						</div>
						<p className="pb-1 text-right text-muted-foreground text-xs">
							<span
								className={cn(
									"font-medium tabular-nums",
									successDelta > 0 && "text-emerald-700 dark:text-emerald-400",
									successDelta < 0 && "text-destructive",
									successDelta === 0 && "text-muted-foreground",
								)}
							>
								{formatPercentagePointDelta(successDelta)}
							</span>
							<br />
							vs previous period
						</p>
					</div>
					<div
						role="progressbar"
						className="mt-3 flex h-2 overflow-hidden rounded-full bg-destructive/15"
						aria-label={`${formatOverviewPercentValue(
							generation.successRatePercent,
						)} of generation attempts succeeded`}
						aria-valuemax={100}
						aria-valuemin={0}
						aria-valuenow={generation.successRatePercent}
					>
						<div
							className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500"
							style={{ width: `${generation.successRatePercent}%` }}
						/>
					</div>
				</div>

				<figure>
					<ChartContainer
						config={generationChartConfig}
						className="aspect-auto h-[82px] w-full"
						role="img"
						aria-label="Successful and failed generation attempts over time"
					>
						<BarChart accessibilityLayer data={points} barCategoryGap="22%">
							<ChartTooltip
								cursor={false}
								content={<ChartTooltipContent hideLabel />}
							/>
							<Bar
								dataKey="successful"
								stackId="attempts"
								fill="var(--color-successful)"
								radius={[0, 0, 2, 2]}
								isAnimationActive={false}
							/>
							<Bar
								dataKey="failed"
								stackId="attempts"
								fill="var(--color-failed)"
								radius={[2, 2, 0, 0]}
								isAnimationActive={false}
							/>
						</BarChart>
					</ChartContainer>
					<figcaption className="sr-only">
						Successful generations make up the large majority of attempts in
						each reporting bucket.
					</figcaption>
				</figure>

				<div className="grid grid-cols-2 overflow-hidden rounded-lg border">
					<div className="border-r border-b px-3 py-3">
						<p className="text-muted-foreground text-xs">Attempts</p>
						<p className="mt-1 font-medium tabular-nums">
							{formatOverviewWholeNumber(generation.attempts)}
						</p>
					</div>
					<div className="border-b px-3 py-3">
						<p className="text-muted-foreground text-xs">Failures</p>
						<p className="mt-1 font-medium text-destructive tabular-nums">
							{formatOverviewWholeNumber(generation.failed)}
						</p>
					</div>
					<div className="border-r px-3 py-3">
						<p className="text-muted-foreground text-xs">Avg. completion</p>
						<p className="mt-1 font-medium tabular-nums">
							{formatOverviewLatency(generation.averageLatencyMs)}
						</p>
					</div>
					<div className="px-3 py-3">
						<p className="text-muted-foreground text-xs">Latency change</p>
						<p
							className={cn(
								"mt-1 font-medium tabular-nums",
								latencyDelta <= 0
									? "text-emerald-700 dark:text-emerald-400"
									: "text-destructive",
							)}
						>
							{formatOverviewPercent(latencyDelta)}
						</p>
					</div>
				</div>

				<div className="border-t pt-4">
					<div className="mb-2 flex items-center justify-between">
						<h3 className="font-medium text-sm">Recent signals</h3>
						<span className="text-muted-foreground text-xs">Live mock</span>
					</div>
					<div className="divide-y">
						{recentSignals.map((signal) => (
							<div key={signal.id} className="flex items-start gap-3 py-3">
								<div
									className={cn(
										"flex size-8 shrink-0 items-center justify-center rounded-md border",
										activityToneClasses[signal.tone],
									)}
								>
									<signal.icon className="size-4" />
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium text-sm">{signal.title}</p>
									<p className="mt-0.5 truncate text-muted-foreground text-xs">
										{signal.detail}
									</p>
								</div>
								<time
									dateTime={getSignalDateTime(
										generatedAt,
										signal.offsetMinutes,
									)}
									className="shrink-0 text-muted-foreground text-xs tabular-nums"
								>
									{signal.offsetMinutes} min
								</time>
							</div>
						))}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export type { GenerationHealthCardProps };
export { GenerationHealthCard };
