import { WalletCardsIcon } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
import type {
	OverviewPaymentProvider,
	OverviewRevenuePoint,
	OverviewRevenueSummary,
} from "@/features/overview/api/overview.dto";
import {
	formatOverviewCompactNumber,
	formatOverviewPercent,
	formatOverviewPercentValue,
	formatOverviewRoundedCurrencyMinor,
	formatOverviewRoundedUsdMinor,
} from "@/features/overview/lib/formatters";
import { cn } from "@/lib/utils";

type RevenuePerformanceCardProps = {
	revenue: OverviewRevenueSummary;
	points: OverviewRevenuePoint[];
	rangeLabel: string;
};

const revenueChartConfig = {
	stripeUsdMinor: {
		label: "Stripe",
		color: "var(--chart-1)",
	},
	chargilyUsdEquivalentMinor: {
		label: "Chargily",
		color: "var(--chart-2)",
	},
} satisfies ChartConfig;

const providerStyles: Record<
	OverviewPaymentProvider,
	{ label: string; className: string; mark: string }
> = {
	stripe: {
		label: "Stripe",
		className: "bg-chart-1",
		mark: "S",
	},
	chargily: {
		label: "Chargily",
		className: "bg-chart-2",
		mark: "C",
	},
};

function formatRevenueAxis(value: number) {
	return `$${formatOverviewCompactNumber(value / 100)}`;
}

function MockFxRateNotice({ quotePerBase }: { quotePerBase: number }) {
	// MOCK DATA: DZD-to-USD reporting rate — no FX-rate source/table exists.
	return (
		<div className="border-t bg-muted/25 px-5 py-2.5 text-muted-foreground text-xs">
			Chargily normalized at 1 USD ={" "}
			<span className="font-medium text-foreground tabular-nums">
				{quotePerBase.toFixed(2)} DZD
			</span>{" "}
			· mock reporting rate
		</div>
	);
}

function RevenuePerformanceCard({
	revenue,
	points,
	rangeLabel,
}: RevenuePerformanceCardProps) {
	// Stripe covers payment orders + subscription invoice settlements; top-up
	// sessions still lack a relational amount source and stay uncounted, and
	// affiliate commission bases are not gross revenue and remain excluded.
	const [visibleProviders, setVisibleProviders] = useState<
		Record<OverviewPaymentProvider, boolean>
	>({
		stripe: true,
		chargily: true,
	});

	function toggleProvider(provider: OverviewPaymentProvider) {
		setVisibleProviders((current) => {
			const next = { ...current, [provider]: !current[provider] };

			if (!next.stripe && !next.chargily) {
				return current;
			}

			return next;
		});
	}

	const providerRevenue = [revenue.stripe, revenue.chargily];
	const hasRevenueInRange =
		revenue.totalReportingUsdMinor > 0 ||
		points.some(
			(point) =>
				point.stripeUsdMinor > 0 || point.chargilyUsdEquivalentMinor > 0,
		);

	return (
		<Card className="h-full gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div>
					<CardTitle>
						<h2>Revenue performance</h2>
					</CardTitle>
					<CardDescription className="mt-1">
						Collected revenue in reporting USD · {rangeLabel.toLowerCase()}
					</CardDescription>
				</div>
				<div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
					<span className="font-display font-semibold text-3xl tabular-nums tracking-tight">
						{formatOverviewRoundedUsdMinor(revenue.totalReportingUsdMinor)}
					</span>
					<span
						className={cn(
							"pb-1 font-medium text-sm tabular-nums",
							revenue.changePercent > 0 &&
								"text-emerald-700 dark:text-emerald-400",
							revenue.changePercent < 0 && "text-destructive",
							revenue.changePercent === 0 && "text-muted-foreground",
						)}
					>
						{formatOverviewPercent(revenue.changePercent)}
					</span>
					<span className="pb-1 text-muted-foreground text-xs">
						vs previous period
					</span>
				</div>
			</CardHeader>

			<CardContent className="px-2 pt-5 pb-6 sm:px-6">
				{hasRevenueInRange ? (
					<figure>
						<ChartContainer
							config={revenueChartConfig}
							className="aspect-auto h-[260px] w-full lg:h-[310px]"
							role="img"
							aria-label={`${rangeLabel} revenue trend split between Stripe and Chargily`}
						>
							<AreaChart
								accessibilityLayer
								data={points}
								margin={{ left: 4, right: 4, top: 8 }}
							>
								<CartesianGrid vertical={false} strokeDasharray="3 3" />
								<XAxis
									dataKey="label"
									axisLine={false}
									tickLine={false}
									tickMargin={10}
									minTickGap={28}
								/>
								<YAxis
									axisLine={false}
									tickLine={false}
									tickMargin={8}
									tickFormatter={(value) => formatRevenueAxis(Number(value))}
									width={54}
								/>
								<ChartTooltip
									cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
									content={
										<ChartTooltipContent
											indicator="line"
											labelFormatter={(value) => value}
											formatter={(value, name) => (
												<div className="flex min-w-40 flex-1 items-center justify-between gap-5">
													<span className="text-muted-foreground">
														{name === "stripeUsdMinor"
															? "Stripe"
															: "Chargily · USD eq."}
													</span>
													<span className="font-medium font-mono tabular-nums">
														{formatOverviewRoundedUsdMinor(Number(value))}
														{name === "chargilyUsdEquivalentMinor" ? (
															<span className="ml-1.5 text-muted-foreground">
																·{" "}
																{formatOverviewRoundedCurrencyMinor(
																	Number(value) * revenue.fx.quotePerBase,
																	"DZD",
																)}
															</span>
														) : null}
													</span>
												</div>
											)}
										/>
									}
								/>
								<Area
									dataKey="stripeUsdMinor"
									type="monotone"
									stackId="revenue"
									fill="var(--color-stripeUsdMinor)"
									fillOpacity={0.16}
									stroke="var(--color-stripeUsdMinor)"
									strokeWidth={2}
									hide={!visibleProviders.stripe}
									isAnimationActive={false}
								/>
								<Area
									dataKey="chargilyUsdEquivalentMinor"
									type="monotone"
									stackId="revenue"
									fill="var(--color-chargilyUsdEquivalentMinor)"
									fillOpacity={0.1}
									stroke="var(--color-chargilyUsdEquivalentMinor)"
									strokeWidth={2}
									hide={!visibleProviders.chargily}
									isAnimationActive={false}
								/>
							</AreaChart>
						</ChartContainer>
						<figcaption className="sr-only">
							The chart compares Stripe revenue with Chargily revenue converted
							to the reporting currency across the selected range.
						</figcaption>
					</figure>
				) : (
					<div className="flex h-[260px] w-full flex-col items-center justify-center gap-2 px-4 text-center lg:h-[310px]">
						<div className="flex size-10 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
							<WalletCardsIcon className="size-5" />
						</div>
						<p className="font-medium text-sm">
							No revenue collected in this range
						</p>
						<p className="max-w-72 text-muted-foreground text-xs">
							Stripe and Chargily payments appear here as soon as a charge is
							recorded.
						</p>
					</div>
				)}
			</CardContent>

			<div className="grid divide-y border-t sm:grid-cols-2 sm:divide-x sm:divide-y-0">
				{providerRevenue.map((provider) => {
					const style = providerStyles[provider.provider];
					const isActive = visibleProviders[provider.provider];
					const share =
						revenue.totalReportingUsdMinor > 0
							? (provider.reportingUsdTotalMinor /
									revenue.totalReportingUsdMinor) *
								100
							: 0;

					return (
						<button
							key={provider.provider}
							type="button"
							aria-pressed={isActive}
							className={cn(
								"group flex items-center gap-3 px-5 py-4 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
								!isActive && "opacity-45",
							)}
							onClick={() => toggleProvider(provider.provider)}
						>
							<span
								className={cn(
									"flex size-8 shrink-0 items-center justify-center rounded-md font-semibold text-primary-foreground text-xs",
									style.className,
								)}
							>
								{style.mark}
							</span>
							<span className="min-w-0 flex-1">
								<span className="flex items-center justify-between gap-3">
									<span className="font-medium text-sm">{style.label}</span>
									<span className="text-muted-foreground text-xs tabular-nums">
										{formatOverviewPercentValue(share)} share
									</span>
								</span>
								<span className="mt-1 flex items-baseline justify-between gap-3">
									<span className="font-semibold tabular-nums">
										{formatOverviewRoundedCurrencyMinor(
											provider.nativeTotalMinor,
											provider.nativeCurrency,
										)}
									</span>
									<span
										className={cn(
											"text-xs tabular-nums",
											provider.changePercent > 0 &&
												"text-emerald-700 dark:text-emerald-400",
											provider.changePercent < 0 && "text-destructive",
											provider.changePercent === 0 && "text-muted-foreground",
										)}
									>
										{formatOverviewPercent(provider.changePercent)}
									</span>
								</span>
							</span>
						</button>
					);
				})}
			</div>

			<MockFxRateNotice quotePerBase={revenue.fx.quotePerBase} />
		</Card>
	);
}

export type { RevenuePerformanceCardProps };
export { RevenuePerformanceCard };
