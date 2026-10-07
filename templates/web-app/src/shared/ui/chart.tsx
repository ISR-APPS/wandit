// Chart frame, tooltip, and legend for recharts (port of shadcn/ui chart, MIT).
// Chart cards wrap one recharts chart in ChartContainer and pass a ChartConfig.
// The container sets --color-<key> from the config, so a chart reads var(--color-<key>)
// and the .dark class switches the colors through the tokens. Numbers use the app locale.

import type { ComponentProps, ComponentType, ReactNode } from "react";
import { createContext, useContext } from "react";
import type {
	LegendPayload,
	TooltipContentProps,
	TooltipValueType,
} from "recharts";
import * as RechartsPrimitive from "recharts";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

/**
 * The series of one chart, keyed by dataKey (a donut keys by category name).
 * A key must be a CSS-safe name (letters, digits, - and _): it becomes `--color-<key>`.
 */
export type ChartConfig = Record<
	string,
	{
		/** Translated name of the series. The tooltip and the legend show it. */
		label?: ReactNode;
		/** Icon in place of the color mark in the tooltip and the legend. */
		icon?: ComponentType;
		/** A CSS color, normally `var(--chart-1)` to `var(--chart-5)`. */
		color?: string;
	}
>;

const ChartContext = createContext<ChartConfig | null>(null);

function useChartConfig(): ChartConfig {
	const config = useContext(ChartContext);
	if (!config) {
		throw new Error("useChartConfig must be used within a <ChartContainer />");
	}
	return config;
}

// Size of the first render, before the container is measured. 0 x 0 makes recharts warn.
const INITIAL_DIMENSION = { width: 320, height: 200 } as const;

/**
 * Sizes one recharts chart to its box and gives it the colors of `config`. Set the height with a class.
 * The --chart-* style knobs set the line and area strokes, the Area fill opacity, and the grid dash.
 * They win over the recharts props strokeWidth, fillOpacity, and strokeDasharray on those parts.
 */
function ChartContainer({
	config,
	className,
	style,
	children,
	...props
}: ComponentProps<"div"> & {
	/** The series of the chart: label and color per dataKey. */
	config: ChartConfig;
	/** One recharts chart, for example an AreaChart. */
	children: ReactNode;
}) {
	// One custom property per colored series. The chart reads it as var(--color-<key>).
	const colorVariables = Object.fromEntries(
		Object.entries(config).flatMap(([key, item]) =>
			item.color ? [[`--color-${key}`, item.color]] : [],
		),
	);
	return (
		<ChartContext.Provider value={config}>
			<div
				data-slot="chart"
				className={cn(
					"[&_.recharts-line-curve]:stroke-(length:--chart-stroke) [&_.recharts-area-curve]:stroke-(length:--chart-stroke) flex aspect-video justify-center text-xs [&_.recharts-area-area]:[fill-opacity:var(--chart-fill-opacity)] [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-cartesian-grid_line]:[stroke-dasharray:var(--chart-grid-dash)] [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-hidden [&_.recharts-surface]:outline-hidden",
					className,
				)}
				style={{ ...colorVariables, ...style }}
				{...props}
			>
				<RechartsPrimitive.ResponsiveContainer
					initialDimension={INITIAL_DIMENSION}
				>
					{children}
				</RechartsPrimitive.ResponsiveContainer>
			</div>
		</ChartContext.Provider>
	);
}

/** The recharts Tooltip. Pass `cursor={false}` and `content={<ChartTooltipContent />}`. */
const ChartTooltip = RechartsPrimitive.Tooltip;

/** A range series (an area band) gives two values; every other series gives one. */
function formatValue(
	value: TooltipValueType,
	numberFormat: Intl.NumberFormat,
): string {
	if (typeof value === "number") {
		return numberFormat.format(value);
	}
	if (typeof value === "string") {
		return value;
	}
	return value
		.map((part) =>
			typeof part === "number" ? numberFormat.format(part) : part,
		)
		.join(" – ");
}

type ChartTooltipContentProps = Partial<
	Pick<TooltipContentProps, "active" | "payload" | "label">
> & {
	/** Hides the title row, for example on a donut where the series name is enough. */
	hideLabel?: boolean;
	/** Hides the color mark before each series. */
	hideIndicator?: boolean;
	/** Shape of the color mark: a square dot, a bar, or a dashed bar. */
	indicator?: "dot" | "line" | "dashed";
	/** Formats the title, for example a day key to a local date. Gets the raw recharts label. */
	labelFormatter?: (label: string | number) => ReactNode;
	/** Intl options of the values, for example a currency. Default: plain numbers. */
	valueFormat?: Intl.NumberFormatOptions;
	className?: string;
};

/** Tooltip body for `<ChartTooltip content={<ChartTooltipContent />} />`. Recharts fills active, payload, and label. */
function ChartTooltipContent({
	active,
	payload,
	label,
	hideLabel = false,
	hideIndicator = false,
	indicator = "dot",
	labelFormatter,
	valueFormat,
	className,
}: ChartTooltipContentProps) {
	const config = useChartConfig();
	const { locale } = useT();
	if (!active || !payload?.length) {
		return null;
	}
	const numberFormat = new Intl.NumberFormat(locale, valueFormat);
	const title =
		hideLabel || label === undefined
			? null
			: labelFormatter
				? labelFormatter(label)
				: label;
	// One series with a bar mark: the title moves into the row, beside the value.
	const nestLabel = payload.length === 1 && indicator !== "dot";

	return (
		<div
			className={cn(
				"grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
				className,
			)}
		>
			{nestLabel || title === null ? null : (
				<div className="font-medium">{title}</div>
			)}
			<div className="grid gap-1.5">
				{payload
					.filter((item) => item.type !== "none")
					.map((item) => {
						// A donut names the category in `name`; a cartesian chart names the series by dataKey.
						const itemConfig =
							config[String(item.name)] ?? config[String(item.dataKey)];
						return (
							<div
								key={String(item.dataKey ?? item.name)}
								className={cn(
									"flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
									indicator === "dot" && "items-center",
								)}
							>
								{itemConfig?.icon ? (
									<itemConfig.icon />
								) : (
									!hideIndicator && (
										<div
											className={cn("shrink-0 rounded-[2px] border", {
												"h-2.5 w-2.5": indicator === "dot",
												"w-1": indicator === "line",
												"w-0 border-[1.5px] border-dashed":
													indicator === "dashed",
												"my-0.5": nestLabel && indicator === "dashed",
											})}
											style={{
												borderColor: item.color,
												backgroundColor:
													indicator === "dashed" ? undefined : item.color,
											}}
										/>
									)
								)}
								<div
									className={cn(
										"flex flex-1 justify-between gap-4 leading-none",
										nestLabel ? "items-end" : "items-center",
									)}
								>
									<div className="grid gap-1.5">
										{nestLabel ? title : null}
										<span className="text-muted-foreground">
											{itemConfig?.label ?? item.name}
										</span>
									</div>
									{item.value === undefined ? null : (
										<span className="font-medium font-mono text-foreground tabular-nums">
											{formatValue(item.value, numberFormat)}
										</span>
									)}
								</div>
							</div>
						);
					})}
			</div>
		</div>
	);
}

/** The recharts Legend. Pass `content={<ChartLegendContent />}`. */
const ChartLegend = RechartsPrimitive.Legend;

/** Legend body for `<ChartLegend content={<ChartLegendContent />} />`. Recharts fills payload. */
function ChartLegendContent({
	payload,
	verticalAlign = "bottom",
	hideIcon = false,
	className,
}: {
	/** Set by recharts: one entry per series. */
	payload?: ReadonlyArray<LegendPayload>;
	/** Set by recharts. "top" puts the space below the legend, else above it. */
	verticalAlign?: "top" | "bottom" | "middle";
	/** Shows the color square even when the config gives an icon. */
	hideIcon?: boolean;
	className?: string;
}) {
	const config = useChartConfig();
	if (!payload?.length) {
		return null;
	}
	return (
		<div
			className={cn(
				"flex items-center justify-center gap-4",
				verticalAlign === "top" ? "pb-3" : "pt-3",
				className,
			)}
		>
			{payload
				.filter((item) => item.type !== "none")
				.map((item) => {
					// Same lookup as the tooltip: the category name first, then the dataKey.
					const itemConfig =
						config[String(item.value)] ?? config[String(item.dataKey)];
					return (
						<div
							// A donut repeats one dataKey for every category, so the name joins the key.
							key={`${String(item.dataKey)}:${String(item.value)}`}
							className="flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
						>
							{itemConfig?.icon && !hideIcon ? (
								<itemConfig.icon />
							) : (
								<div
									className="h-2 w-2 shrink-0 rounded-[2px]"
									style={{ backgroundColor: item.color }}
								/>
							)}
							{itemConfig?.label ?? item.value}
						</div>
					);
				})}
		</div>
	);
}

export {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
};
