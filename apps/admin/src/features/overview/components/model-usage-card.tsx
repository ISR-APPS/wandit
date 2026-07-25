import { useState } from "react";
import { Cell, Label, Pie, PieChart } from "recharts";

import {
	Card,
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
import type { OverviewModelUsage } from "@/features/overview/api/overview.dto";
import {
	formatOverviewCompactNumber,
	formatOverviewPercentValue,
	formatOverviewUsdMinor,
} from "@/features/overview/lib/formatters";
import { cn } from "@/lib/utils";

type ModelUsageCardProps = {
	models: OverviewModelUsage[];
};

const modelColors = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
] as const;

const modelChartConfig = {
	tokensUsed: {
		label: "Tokens",
	},
} satisfies ChartConfig;

function ModelUsageCard({ models }: ModelUsageCardProps) {
	const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
	const totalTokens = models.reduce(
		(total, model) => total + model.tokensUsed,
		0,
	);
	const selectedModel =
		models.find((model) => model.modelId === selectedModelId) ?? null;
	const chartData = models.map((model, index) => ({
		...model,
		fill: modelColors[index % modelColors.length],
	}));

	return (
		<Card className="h-full shadow-none">
			<CardHeader>
				<CardTitle>
					<h2>Model mix</h2>
				</CardTitle>
				<CardDescription>
					Token volume and estimated cost by model
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				<figure>
					<ChartContainer
						config={modelChartConfig}
						className="mx-auto aspect-square h-[210px] max-h-[210px] w-full"
						role="img"
						aria-label="Token usage share by AI model"
					>
						<PieChart>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										hideLabel
										formatter={(value, _name, item) => (
											<div className="flex min-w-44 flex-1 items-center justify-between gap-5">
												<span className="text-muted-foreground">
													{String(item.payload.modelName)}
												</span>
												<span className="font-medium font-mono tabular-nums">
													{formatOverviewCompactNumber(Number(value))}
												</span>
											</div>
										)}
									/>
								}
							/>
							<Pie
								data={chartData}
								dataKey="tokensUsed"
								nameKey="modelName"
								innerRadius={64}
								outerRadius={92}
								paddingAngle={2}
								strokeWidth={0}
								isAnimationActive={false}
							>
								{chartData.map((model) => (
									<Cell
										key={model.modelId}
										fill={model.fill}
										opacity={
											selectedModelId === null ||
											selectedModelId === model.modelId
												? 1
												: 0.28
										}
									/>
								))}
								<Label
									content={({ viewBox }) => {
										if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) {
											return null;
										}

										return (
											<text
												x={viewBox.cx}
												y={viewBox.cy}
												textAnchor="middle"
												dominantBaseline="middle"
											>
												<tspan
													x={viewBox.cx}
													y={(viewBox.cy ?? 0) - 5}
													className="fill-foreground font-semibold text-xl"
												>
													{selectedModel
														? formatOverviewPercentValue(
																selectedModel.usageSharePercent,
															)
														: formatOverviewCompactNumber(totalTokens)}
												</tspan>
												<tspan
													x={viewBox.cx}
													y={(viewBox.cy ?? 0) + 17}
													className="fill-muted-foreground text-[10px]"
												>
													{selectedModel ? "usage share" : "tokens"}
												</tspan>
											</text>
										);
									}}
								/>
							</Pie>
						</PieChart>
					</ChartContainer>
					<figcaption className="sr-only">
						The chart shows the proportion of token usage attributed to each AI
						model in the selected range.
					</figcaption>
				</figure>

				<div className="space-y-1">
					{chartData.map((model) => {
						const isSelected = selectedModelId === model.modelId;

						return (
							<button
								key={model.modelId}
								type="button"
								aria-pressed={isSelected}
								className={cn(
									"group w-full rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring",
									isSelected && "bg-muted",
								)}
								onClick={() =>
									setSelectedModelId((current) =>
										current === model.modelId ? null : model.modelId,
									)
								}
							>
								<span className="flex items-start justify-between gap-3">
									<span className="flex min-w-0 items-center gap-2">
										<span
											className="mt-1 size-2 shrink-0 rounded-full"
											style={{ backgroundColor: model.fill }}
										/>
										<span className="min-w-0">
											<span className="block truncate font-medium text-sm">
												{model.modelName}
											</span>
											<span className="block text-muted-foreground text-xs capitalize">
												{model.provider}
											</span>
										</span>
									</span>
									<span className="shrink-0 text-right">
										<span className="block font-medium text-sm tabular-nums">
											{formatOverviewPercentValue(model.usageSharePercent)}
										</span>
										<span className="block text-muted-foreground text-xs tabular-nums">
											{formatOverviewUsdMinor(model.estimatedCostUsdMinor)}
										</span>
									</span>
								</span>
								<span className="mt-2 block h-1 overflow-hidden rounded-full bg-muted">
									<span
										className="block h-full rounded-full"
										style={{
											backgroundColor: model.fill,
											width: `${model.usageSharePercent}%`,
										}}
									/>
								</span>
							</button>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}

export type { ModelUsageCardProps };
export { ModelUsageCard };
