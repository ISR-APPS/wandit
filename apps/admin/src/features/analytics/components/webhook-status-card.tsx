import type { AdminAnalyticsWebhookHealth } from "@wandit/contracts";
import {
	ArchiveXIcon,
	CircleCheckIcon,
	CircleXIcon,
	SkipForwardIcon,
	WebhookIcon,
} from "lucide-react";

import { MetricInfoTooltip } from "@/components/metric-info-tooltip";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { formatOverviewWholeNumber } from "@/features/overview/lib/formatters";
import { cn } from "@/lib/utils";

type WebhookStatusCardProps = {
	webhooks: AdminAnalyticsWebhookHealth;
};

const webhookStatuses = [
	{
		key: "processed",
		label: "Processed",
		tooltip:
			"Billing messages received in the selected range and handled successfully.",
		icon: CircleCheckIcon,
		tone: "text-emerald-700 dark:text-emerald-400",
	},
	{
		key: "skipped",
		label: "Skipped",
		tooltip:
			"Billing messages received in the selected range that needed no action, so we intentionally ignored them.",
		icon: SkipForwardIcon,
		tone: "text-muted-foreground",
	},
	{
		key: "failed",
		label: "Failed",
		tooltip:
			"Billing messages received in the selected range that we could not handle. The system may try them again.",
		icon: CircleXIcon,
		tone: "text-destructive",
	},
	{
		key: "deadLettered",
		label: "Dead-lettered",
		tooltip:
			"Billing messages that failed too many times and will not be tried again automatically.",
		icon: ArchiveXIcon,
		tone: "text-destructive",
	},
] as const;

function WebhookStatusCard({ webhooks }: WebhookStatusCardProps) {
	return (
		<Card className="gap-0 py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-[200px] flex-1">
						<CardTitle>
							<h2>Billing webhooks</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							Inbox outcomes in the selected range
						</CardDescription>
					</div>
					<Badge
						variant="outline"
						className={cn(
							"shrink-0 tabular-nums",
							webhooks.failed > 0 || webhooks.deadLettered > 0
								? "border-destructive/20 bg-destructive/10 text-destructive"
								: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
						)}
					>
						{webhooks.failed > 0 || webhooks.deadLettered > 0
							? "Needs attention"
							: "No failures"}
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="pt-5 pb-6">
				<div className="flex items-center gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
						<WebhookIcon className="size-5" />
					</div>
					<div>
						<div className="flex items-center gap-1">
							<p className="text-muted-foreground text-xs">Received</p>
							<MetricInfoTooltip
								label="Received"
								content="Billing messages received from our payment provider during the selected range."
							/>
						</div>
						<p className="mt-0.5 font-semibold text-2xl tabular-nums tracking-tight">
							{formatOverviewWholeNumber(webhooks.received)}
						</p>
					</div>
				</div>

				<div className="mt-5 overflow-hidden rounded-lg border">
					<div className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2">
						{webhookStatuses.map((status) => {
							const Icon = status.icon;

							return (
								<div
									key={status.key}
									className="flex items-start gap-2.5 border-r border-b px-3 py-3"
								>
									<Icon className={cn("mt-0.5 size-4 shrink-0", status.tone)} />
									<div className="min-w-0">
										<div className="flex items-center gap-1">
											<p className="text-muted-foreground text-xs leading-4">
												{status.label}
											</p>
											<MetricInfoTooltip
												label={status.label}
												content={status.tooltip}
											/>
										</div>
										<p className={cn("font-medium tabular-nums", status.tone)}>
											{formatOverviewWholeNumber(webhooks[status.key])}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export type { WebhookStatusCardProps };
export { WebhookStatusCard };
