import type { LucideIcon } from "lucide-react";
import {
	CircleCheckIcon,
	CreditCardIcon,
	RotateCcwIcon,
	UserRoundPlusIcon,
} from "lucide-react";
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
	OverviewSignal,
	OverviewSignalKind,
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
	signals: OverviewSignal[];
	generatedAt: string;
};

type ActivityTone = "success" | "warning" | "neutral";

// Successful must match the emerald the progress bar above the chart uses,
// so one card encodes "success" with one color.
const generationChartConfig = {
	successful: {
		label: "Successful",
		theme: {
			light: "var(--color-emerald-600)",
			dark: "var(--color-emerald-500)",
		},
	},
	failed: {
		label: "Failed",
		color: "var(--destructive)",
	},
} satisfies ChartConfig;

const activityToneClasses: Record<ActivityTone, string> = {
	success:
		"border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
	warning:
		"border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
	neutral: "border-border bg-muted text-muted-foreground",
};

const signalPresentation: Record<
	OverviewSignalKind,
	{ icon: LucideIcon; tone: ActivityTone }
> = {
	payment: { icon: CreditCardIcon, tone: "success" },
	page_generation_succeeded: { icon: CircleCheckIcon, tone: "success" },
	page_generation_failed: { icon: RotateCcwIcon, tone: "warning" },
	lead: { icon: UserRoundPlusIcon, tone: "neutral" },
};

function formatPercentagePointDelta(value: number) {
	const sign = value > 0 ? "+" : value < 0 ? "−" : "";
	return `${sign}${Math.abs(value).toFixed(1)} pp`;
}

function formatSignalAge(generatedAt: string, occurredAt: string) {
	const elapsedMinutes = Math.max(
		0,
		Math.floor((Date.parse(generatedAt) - Date.parse(occurredAt)) / 60_000),
	);

	if (elapsedMinutes < 1) {
		return "now";
	}

	if (elapsedMinutes < 60) {
		return `${elapsedMinutes} min`;
	}

	const elapsedHours = Math.floor(elapsedMinutes / 60);
	if (elapsedHours < 24) {
		return `${elapsedHours} hr`;
	}

	return `${Math.floor(elapsedHours / 24)} d`;
}

function MockOperationalStatusBadge() {
	// MOCK DATA: operational platform status — no health/status source exists.
	return (
		<Badge
			variant="outline"
			className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
		>
			<span className="size-1.5 rounded-full bg-current" />
			Operational · Mock
		</Badge>
	);
}

function GenerationHealthCard({
	generation,
	points,
	signals,
	generatedAt,
}: GenerationHealthCardProps) {
	const successDelta = generation.successRateChangePoints;
	const latencyDelta = generation.latencyChangePercent;

	return (
		<Card className="h-full gap-0 py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div>
					<CardTitle>
						<h2>Generation health</h2>
					</CardTitle>
					<CardDescription className="mt-1">
						Completion quality and recent platform signals
					</CardDescription>
				</div>
				<CardAction>
					<MockOperationalStatusBadge />
				</CardAction>
			</CardHeader>

			<CardContent className="flex min-h-0 flex-1 flex-col gap-5 pt-5 pb-6">
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

				<div className="flex-1 border-t pt-4">
					<div className="mb-2 flex items-center justify-between">
						<h3 className="font-medium text-sm">Recent signals</h3>
					</div>
					<div className="divide-y">
						{signals.length === 0 ? (
							<p className="py-4 text-muted-foreground text-sm">
								No recent signals.
							</p>
						) : (
							signals.map((signal) => {
								const presentation = signalPresentation[signal.kind];
								const SignalIcon = presentation.icon;

								return (
									<div
										key={`${signal.kind}:${signal.id}`}
										className="flex items-start gap-3 py-3"
									>
										<div
											className={cn(
												"flex size-8 shrink-0 items-center justify-center rounded-md border",
												activityToneClasses[presentation.tone],
											)}
										>
											<SignalIcon className="size-4" />
										</div>
										<div className="min-w-0 flex-1">
											<p className="truncate font-medium text-sm">
												{signal.title}
											</p>
											<p className="mt-0.5 truncate text-muted-foreground text-xs">
												{signal.detail}
											</p>
										</div>
										<time
											dateTime={signal.occurredAt}
											className="shrink-0 text-muted-foreground text-xs tabular-nums"
										>
											{formatSignalAge(generatedAt, signal.occurredAt)}
										</time>
									</div>
								);
							})
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export type { GenerationHealthCardProps };
export { GenerationHealthCard };
