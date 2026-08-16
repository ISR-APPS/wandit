import type {
	AdminAnalyticsFunnelStep,
	AdminAnalyticsFunnelStepKey,
} from "@wandit/contracts";
import { BadgeCheckIcon, MousePointerClickIcon } from "lucide-react";

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
	funnelStepMetadata,
	orderFunnelSteps,
} from "@/features/analytics/lib/analytics-data";
import {
	formatOverviewPercentValue,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";
import { cn } from "@/lib/utils";

type FunnelStepVisualizationProps = {
	steps: AdminAnalyticsFunnelStep[];
	hasActiveFilters?: boolean;
};

const funnelStepDescriptions = {
	visitor: "Story-link and affiliate traffic",
	signup: "Accounts created in range",
	firstAction: "Prompt or project created",
	activated: "First successful generation",
	healthyTrial: "20+ credits and 2+ generations",
	pricingViewed: "A pricing surface was viewed",
	upgradeClicked: "An upgrade entry point was clicked",
	checkoutStarted: "Subscription checkout only",
	paid: "Ever started a subscription",
} satisfies Record<AdminAnalyticsFunnelStepKey, string>;

function FunnelStepRow({
	step,
	maxCount,
	hasActiveFilters,
}: {
	step: AdminAnalyticsFunnelStep;
	maxCount: number;
	hasActiveFilters: boolean;
}) {
	const metadata = funnelStepMetadata[step.key];
	const description = funnelStepDescriptions[step.key];
	const isUnavailable = step.count === null;
	const isFilteredVisitorUnavailable =
		step.key === "visitor" && step.count === null && hasActiveFilters;
	const relativeWidth =
		step.count === null || maxCount <= 0 ? 0 : step.count / maxCount;
	const visibleWidth =
		step.count && relativeWidth > 0 ? Math.max(relativeWidth, 0.025) : 0;

	return (
		<li
			className={cn(
				"grid gap-3 border-b px-5 py-4 last:border-b-0 md:grid-cols-[minmax(190px,0.85fr)_minmax(240px,2fr)_minmax(118px,0.55fr)] md:items-center md:px-6",
				isUnavailable && "bg-muted/20 text-muted-foreground",
			)}
		>
			<div className="min-w-0">
				<div className="flex items-center gap-1">
					<h3 className="font-medium text-sm">{metadata.label}</h3>
					<MetricInfoTooltip
						label={metadata.label}
						content={metadata.tooltip}
					/>
				</div>
				<p className="mt-0.5 text-muted-foreground text-xs">{description}</p>
			</div>

			{isUnavailable ? (
				<div className="flex h-8 items-center justify-center rounded-md border border-dashed bg-muted/30 px-3 text-center font-medium text-xs">
					{isFilteredVisitorUnavailable
						? "Not available with filters"
						: (metadata.unavailableLabel ?? "Unavailable")}
				</div>
			) : (
				<div
					className="relative h-8 overflow-hidden rounded-md bg-muted"
					role="img"
					aria-label={`${metadata.label}: ${formatOverviewWholeNumber(step.count ?? 0)}`}
				>
					<div
						aria-hidden="true"
						className="absolute inset-0 origin-left bg-primary/75"
						style={{ transform: `scaleX(${visibleWidth})` }}
					/>
				</div>
			)}

			<div className="md:text-right">
				<p
					className={cn(
						"font-semibold text-xl tabular-nums tracking-tight",
						isUnavailable && "text-muted-foreground",
					)}
				>
					{step.count === null ? "—" : formatOverviewWholeNumber(step.count)}
				</p>
				<p className="mt-0.5 text-muted-foreground text-xs tabular-nums">
					{isFilteredVisitorUnavailable
						? "Anonymous traffic cannot be attributed"
						: step.key === "visitor"
							? "Starting point"
							: step.pctOfPrevious === null
								? "Previous step unavailable"
								: `${formatOverviewPercentValue(step.pctOfPrevious)} of previous`}
				</p>
			</div>
		</li>
	);
}

function FunnelStepVisualization({
	steps,
	hasActiveFilters = false,
}: FunnelStepVisualizationProps) {
	const orderedSteps = orderFunnelSteps(steps);
	const maxCount = Math.max(
		0,
		...orderedSteps.flatMap((step) =>
			step.count === null ? [] : [step.count],
		),
	);

	return (
		<Card className="gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-[220px] flex-1">
						<CardTitle>
							<h2 className="flex items-center gap-1">
								Signup-to-paid funnel
								<MetricInfoTooltip
									label="Signup-to-paid funnel"
									content="Steps after tracked clicks count users who signed up in the selected range and later reached each milestone. They are cohort outcomes, not events limited to the range."
								/>
							</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							Count and conversion from the previous step
						</CardDescription>
					</div>
					<Badge variant="outline" className="shrink-0 bg-muted/30">
						<BadgeCheckIcon aria-hidden="true" />
						Signup cohort
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				{maxCount > 0 || hasActiveFilters ? (
					<ol aria-label="Signup-to-paid funnel steps">
						{orderedSteps.map((step) => (
							<FunnelStepRow
								key={step.key}
								step={step}
								maxCount={maxCount}
								hasActiveFilters={hasActiveFilters}
							/>
						))}
					</ol>
				) : (
					<div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
						<span className="flex size-10 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
							<MousePointerClickIcon aria-hidden="true" className="size-5" />
						</span>
						<p className="mt-3 font-medium text-sm">
							No funnel activity in this range
						</p>
						<p className="mt-1 max-w-sm text-muted-foreground text-xs">
							Tracked traffic and signup-cohort milestones will appear here.
						</p>
					</div>
				)}
			</CardContent>

			<div className="flex items-start gap-2 border-t bg-muted/20 px-5 py-3 text-muted-foreground text-xs leading-relaxed">
				<MousePointerClickIcon
					aria-hidden="true"
					className="mt-0.5 size-3.5 shrink-0"
				/>
				<p>
					Tracked clicks are approximate. User milestones follow people who
					signed up in the selected range, even when a later step happened
					afterward.
				</p>
			</div>
		</Card>
	);
}

export type { FunnelStepVisualizationProps };
export { FunnelStepVisualization };
