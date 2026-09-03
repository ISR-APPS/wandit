import type { LucideIcon } from "lucide-react";
import {
	ActivityIcon,
	Link2Icon,
	MousePointerClickIcon,
	UsersRoundIcon,
} from "lucide-react";

import { MetricInfoTooltip } from "@/components/metric-info-tooltip";
import { formatOverviewWholeNumber } from "@/features/overview/lib/formatters";
import type { StoryLinkListItem } from "@/features/story-links/api/story-links.dto";

type StoryLinkMetricsProps = {
	links: readonly StoryLinkListItem[];
	rangeLabel: string;
};

type StoryLinkMetric = {
	key: string;
	label: string;
	tooltip: string;
	value: number;
	description: string;
	icon: LucideIcon;
};

function StoryLinkMetrics({ links, rangeLabel }: StoryLinkMetricsProps) {
	const totalClicks = links.reduce(
		(total, link) => total + link.clicksInRange,
		0,
	);
	const uniqueVisitors = links.reduce(
		(total, link) => total + link.uniqueVisitorsInRange,
		0,
	);
	const activeLinks = links.filter((link) => link.archivedAt === null).length;
	const allTimeClicks = links.reduce(
		(total, link) => total + link.allTimeClicks,
		0,
	);

	const metrics: StoryLinkMetric[] = [
		{
			key: "clicks",
			label: "Total clicks in range",
			tooltip:
				"Every recorded visit through a story link during the selected range, including archived links.",
			value: totalClicks,
			description: rangeLabel,
			icon: MousePointerClickIcon,
		},
		{
			key: "visitors",
			label: "Unique visitors in range",
			tooltip:
				"The sum of unique visitors for each link. The same person can count once on more than one link.",
			value: uniqueVisitors,
			description: "Unique within each link",
			icon: UsersRoundIcon,
		},
		{
			key: "active",
			label: "Active links",
			tooltip:
				"Links that are not archived and can still send visitors to their destination.",
			value: activeLinks,
			description: `${formatOverviewWholeNumber(links.length)} total links`,
			icon: Link2Icon,
		},
		{
			key: "all-time",
			label: "All-time clicks",
			tooltip:
				"All recorded visits since these links were created, including visits before a link was archived.",
			value: allTimeClicks,
			description: "Since each link was created",
			icon: ActivityIcon,
		},
	];

	return (
		<section aria-label="Story link headline metrics">
			<div className="overflow-hidden rounded-xl border bg-background">
				<div className="-mr-px -mb-px grid @[960px]/main:grid-cols-4 grid-cols-1 sm:grid-cols-2">
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
								<p className="mt-1.5 min-h-7 whitespace-nowrap font-semibold text-xl tabular-nums tracking-tight">
									{formatOverviewWholeNumber(metric.value)}
								</p>
								<p className="mt-1.5 line-clamp-2 min-h-8 text-muted-foreground text-xs leading-4">
									{metric.description}
								</p>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

export type { StoryLinkMetricsProps };
export { StoryLinkMetrics };
