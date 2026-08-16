import type { AdminAnalyticsGenerationHealth } from "@wandit/contracts";

import { MetricInfoTooltip } from "@/components/metric-info-tooltip";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { InlinePercentageBar } from "@/features/analytics/components/inline-percentage-bar";
import {
	formatOverviewLatency,
	formatOverviewPercentValue,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";
import { cn } from "@/lib/utils";

type GenerationHealthTableProps = {
	generation: AdminAnalyticsGenerationHealth[];
};

const generationLabels = {
	pages: "Pages",
	images: "Images",
	videos: "Videos",
	marketing: "Marketing",
	connectors: "Connectors",
	leadScraping: "Lead scraping",
} satisfies Record<AdminAnalyticsGenerationHealth["key"], string>;

function GenerationHealthTable({ generation }: GenerationHealthTableProps) {
	return (
		<Card className="h-full gap-0 py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-[200px] flex-1">
						<CardTitle>
							<h2>Generation reliability</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							Attempt outcomes and completion latency by feature
						</CardDescription>
					</div>
					<Badge
						variant="outline"
						className="shrink-0 text-muted-foreground tabular-nums"
					>
						{generation.length} sources
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="px-0">
				<Table className="min-w-[760px] tabular-nums">
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead className="h-11 pl-6">Feature</TableHead>
							<TableHead className="h-11 text-right">Attempts</TableHead>
							<TableHead className="h-11 min-w-40">
								<div className="flex items-center gap-1">
									<span>Success</span>
									<MetricInfoTooltip
										label="Success"
										content="Share of generation attempts that finished successfully during the selected range."
									/>
								</div>
							</TableHead>
							<TableHead className="h-11 text-right">Failure</TableHead>
							<TableHead className="h-11 text-right">
								<div className="flex items-center justify-end gap-1">
									<span>p50</span>
									<MetricInfoTooltip
										label="p50"
										content="Half of runs finish faster than p50. 95% finish faster than p95."
									/>
								</div>
							</TableHead>
							<TableHead className="h-11 pr-6 text-right">
								<div className="flex items-center justify-end gap-1">
									<span>p95</span>
									<MetricInfoTooltip
										label="p95"
										content="Half of runs finish faster than p50. 95% finish faster than p95."
									/>
								</div>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{generation.length === 0 ? (
							<TableRow className="hover:bg-transparent">
								<TableCell
									colSpan={6}
									className="h-36 px-6 text-center text-muted-foreground"
								>
									Generation attempts will appear here once a feature runs.
								</TableCell>
							</TableRow>
						) : (
							generation.map((item) => {
								const label = generationLabels[item.key];

								return (
									<TableRow key={item.key}>
										<TableCell className="pl-6 font-medium">
											<div className="flex items-center gap-1">
												<span>{label}</span>
												{item.latencyIncludesQueue ? (
													<MetricInfoTooltip
														label={`${label} latency`}
														content="Rows from before the start-time rollout include queue wait."
													/>
												) : null}
											</div>
										</TableCell>
										<TableCell className="text-right font-medium">
											{formatOverviewWholeNumber(item.attempts)}
										</TableCell>
										<TableCell>
											{item.attempts === 0 ? (
												<span className="text-muted-foreground">—</span>
											) : (
												<div className="flex min-w-32 flex-col gap-1.5">
													<span className="font-medium text-xs">
														{formatOverviewPercentValue(item.successPct)}
													</span>
													<InlinePercentageBar
														value={item.successPct}
														label={`${label} success rate`}
													/>
												</div>
											)}
										</TableCell>
										<TableCell
											className={cn(
												"text-right font-medium",
												item.failurePct > 0
													? "text-destructive"
													: "text-muted-foreground",
											)}
										>
											{item.attempts === 0
												? "—"
												: formatOverviewPercentValue(item.failurePct)}
										</TableCell>
										<TableCell className="text-right font-medium">
											{item.attempts === 0
												? "—"
												: formatOverviewLatency(item.p50Ms)}
										</TableCell>
										<TableCell className="pr-6 text-right font-medium">
											{item.attempts === 0
												? "—"
												: formatOverviewLatency(item.p95Ms)}
										</TableCell>
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

export type { GenerationHealthTableProps };
export { GenerationHealthTable };
