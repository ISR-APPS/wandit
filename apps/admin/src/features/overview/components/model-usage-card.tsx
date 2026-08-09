import { useMemo, useState } from "react";
import { Cell, Label, Pie, PieChart } from "recharts";

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

// Models beyond the top five aggregate into one "Other" slice so the donut
// keeps distinct colors instead of cycling the five-color palette.
const TOP_MODEL_SLICES = 5;

const modelColors = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
] as const;

const otherSliceColor = "var(--muted-foreground)";
const otherSliceKey = "\u0000other";

const modelChartConfig = {
	tokensUsed: {
		label: "Tokens",
	},
} satisfies ChartConfig;

type ModelSlice = {
	key: string;
	sliceName: string;
	tokensUsed: number;
	fill: string;
};

function ModelUsageCard({ models }: ModelUsageCardProps) {
	const [selectedModelKey, setSelectedModelKey] = useState<string | null>(null);
	const { listData, slices, otherModelKeys, totalTokens } = useMemo(() => {
		const ranked = [...models].sort((a, b) => b.tokensUsed - a.tokensUsed);
		const top = ranked.slice(0, TOP_MODEL_SLICES);
		const rest = ranked.slice(TOP_MODEL_SLICES);
		const restKeys = new Set(rest.map(getModelKey));
		const colorByKey = new Map(
			top.map((model, index) => [getModelKey(model), modelColors[index]]),
		);
		const sliceRows: ModelSlice[] = top.map((model) => ({
			key: getModelKey(model),
			sliceName: model.modelName,
			tokensUsed: model.tokensUsed,
			fill: colorByKey.get(getModelKey(model)) ?? otherSliceColor,
		}));

		if (rest.length > 0) {
			sliceRows.push({
				key: otherSliceKey,
				sliceName:
					rest.length === 1 ? "1 other model" : `${rest.length} other models`,
				tokensUsed: rest.reduce((total, model) => total + model.tokensUsed, 0),
				fill: otherSliceColor,
			});
		}

		return {
			listData: ranked.map((model) => ({
				...model,
				key: getModelKey(model),
				fill: colorByKey.get(getModelKey(model)) ?? otherSliceColor,
			})),
			slices: sliceRows,
			otherModelKeys: restKeys,
			totalTokens: ranked.reduce((total, model) => total + model.tokensUsed, 0),
		};
	}, [models]);
	const selectedModel =
		listData.find((model) => model.key === selectedModelKey) ?? null;
	const activeSliceKey = selectedModel
		? otherModelKeys.has(selectedModel.key)
			? otherSliceKey
			: selectedModel.key
		: null;

	return (
		<Card className="h-full min-h-0 shadow-none">
			<CardHeader>
				<div>
					<CardTitle>
						<h2>Model mix</h2>
					</CardTitle>
					<CardDescription className="mt-1">
						Token volume and recorded cost by model
					</CardDescription>
				</div>
				{models.length > 0 ? (
					<CardAction>
						<Badge variant="outline" className="text-muted-foreground">
							{models.length === 1 ? "1 model" : `${models.length} models`}
						</Badge>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent className="flex min-h-0 flex-1 flex-col gap-5">
				{listData.length === 0 ? (
					<div className="flex h-[210px] items-center justify-center text-center text-muted-foreground text-sm">
						No model usage in this range.
					</div>
				) : (
					<>
						<figure className="shrink-0">
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
															{String(item.payload.sliceName)}
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
										data={slices}
										dataKey="tokensUsed"
										nameKey="sliceName"
										innerRadius={64}
										outerRadius={92}
										paddingAngle={2}
										strokeWidth={0}
										isAnimationActive={false}
									>
										{slices.map((slice) => (
											<Cell
												key={slice.key}
												fill={slice.fill}
												opacity={
													activeSliceKey === null ||
													activeSliceKey === slice.key
														? 1
														: 0.28
												}
											/>
										))}
										<Label
											content={({ viewBox }) => {
												if (
													!viewBox ||
													!("cx" in viewBox) ||
													!("cy" in viewBox)
												) {
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
								The chart shows the proportion of token usage attributed to each
								AI model in the selected range.
							</figcaption>
						</figure>

						{/* Bounded on stacked layouts by max-h, from lg by the card filling
						    the revenue row: the tail of the list scrolls in place. */}
						<div className="max-h-[380px] min-h-0 flex-1 space-y-1 overflow-y-auto lg:max-h-none">
							{listData.map((model) => {
								const isSelected = selectedModelKey === model.key;

								return (
									<button
										key={model.key}
										type="button"
										aria-pressed={isSelected}
										className={cn(
											"group w-full rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring",
											isSelected && "bg-muted",
										)}
										onClick={() =>
											setSelectedModelKey((current) =>
												current === model.key ? null : model.key,
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
													{formatOverviewUsdMinor(model.costUsdMinor)}
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
					</>
				)}
			</CardContent>
		</Card>
	);
}

function getModelKey(model: OverviewModelUsage) {
	return `${model.provider}\u0000${model.modelId}`;
}

export type { ModelUsageCardProps };
export { ModelUsageCard };
