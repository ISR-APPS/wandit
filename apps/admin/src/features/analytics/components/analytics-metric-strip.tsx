import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { MetricInfoTooltip } from "@/components/metric-info-tooltip";
import { cn } from "@/lib/utils";

type AnalyticsMetric = {
	key: string;
	label: string;
	tooltip: string;
	value: ReactNode;
	description: ReactNode;
	icon: LucideIcon;
	badge?: ReactNode;
};

type AnalyticsMetricStripProps = {
	label: string;
	metrics: AnalyticsMetric[];
};

function AnalyticsMetricStrip({ label, metrics }: AnalyticsMetricStripProps) {
	return (
		<section aria-label={label}>
			<div className="overflow-hidden rounded-xl border bg-background">
				<div
					className={cn(
						"-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2",
						metrics.length > 4
							? "@[960px]/main:grid-cols-3"
							: "@[960px]/main:grid-cols-4",
					)}
				>
					{metrics.map((metric) => (
						<div
							key={metric.key}
							className="flex min-w-[200px] items-start gap-3 border-r border-b px-5 py-5"
						>
							<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
								<metric.icon className="size-4" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex min-h-4 items-center gap-1">
									<p className="whitespace-nowrap text-muted-foreground text-xs leading-4">
										{metric.label}
									</p>
									<MetricInfoTooltip
										label={metric.label}
										content={metric.tooltip}
									/>
								</div>
								<div className="mt-1.5 flex min-h-7 flex-wrap items-center justify-between gap-x-2 gap-y-1">
									<div className="min-w-0 whitespace-nowrap font-semibold text-xl tabular-nums tracking-tight">
										{metric.value}
									</div>
									{metric.badge == null ? null : (
										<div className="ml-auto shrink-0">{metric.badge}</div>
									)}
								</div>
								<div className="mt-1.5 line-clamp-2 min-h-8 text-muted-foreground text-xs leading-4">
									{metric.description}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

export type { AnalyticsMetric, AnalyticsMetricStripProps };
export { AnalyticsMetricStrip };
