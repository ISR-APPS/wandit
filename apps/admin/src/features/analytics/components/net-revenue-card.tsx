import type { AdminAnalyticsNetRevenue } from "@wandit/contracts";
import { CircleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

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
	formatOverviewUsdMinor,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";

type NetRevenueCardProps = {
	netRevenue: AdminAnalyticsNetRevenue;
};

type NetRevenueMetricProps = {
	description: string;
	label: string;
	tooltip: string;
	value: ReactNode;
};

function NetRevenueMetric({
	description,
	label,
	tooltip,
	value,
}: NetRevenueMetricProps) {
	return (
		<div className="min-w-0 border-r border-b px-5 py-4">
			<div className="flex min-h-4 items-center gap-1">
				<p className="text-muted-foreground text-xs leading-4">{label}</p>
				<MetricInfoTooltip label={label} content={tooltip} />
			</div>
			<p className="mt-1.5 font-semibold text-xl tabular-nums tracking-tight">
				{value}
			</p>
			<p className="mt-1 text-muted-foreground text-xs leading-4">
				{description}
			</p>
		</div>
	);
}

function NetRevenueCard({ netRevenue }: NetRevenueCardProps) {
	return (
		<Card className="h-full gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-[200px] flex-1">
						<CardTitle>
							<h2>Net revenue</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							Collections after cash refunds in the selected range
						</CardDescription>
					</div>
					<Badge variant="outline" className="shrink-0 bg-muted/30">
						USD
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="flex-1 p-0">
				<div className="border-b px-5 py-5">
					<div className="flex items-center gap-1">
						<p className="text-muted-foreground text-xs">Net collected</p>
						<MetricInfoTooltip
							label="Net collected"
							content="Gross collected revenue minus cash refunds recorded during the selected range."
						/>
					</div>
					<p className="mt-1 font-display font-semibold text-3xl tabular-nums tracking-tight">
						{formatOverviewUsdMinor(netRevenue.netCents)}
					</p>
					<p className="mt-1 text-muted-foreground text-xs">
						Gross revenue less refunds
					</p>
				</div>

				<div className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2">
					<NetRevenueMetric
						label="Gross collected"
						tooltip="Money collected from paid subscription invoices, completed orders and top-up packs during the selected range, before cash refunds."
						value={formatOverviewUsdMinor(netRevenue.grossCents)}
						description="Before cash refunds"
					/>
					<NetRevenueMetric
						label="Refunds"
						tooltip="Cash refund increments recorded during the selected range. These are payment refunds, not credits returned after failed AI work."
						value={formatOverviewUsdMinor(netRevenue.refundsCents)}
						description="Cash returned to customers"
					/>
					<NetRevenueMetric
						label="Failed payments"
						tooltip="Payment attempts that failed during the selected range. They are informational and are not subtracted from revenue because they were never collected."
						value={formatOverviewWholeNumber(netRevenue.failedPayments)}
						description="Failed attempts"
					/>
					<NetRevenueMetric
						label="Failed amount"
						tooltip="Amount due on payments that failed during the selected range. It is informational and is not subtracted from revenue because it was never collected."
						value={formatOverviewUsdMinor(netRevenue.failedPaymentsCents)}
						description="Attempted, not collected"
					/>
				</div>
			</CardContent>

			<div className="flex items-start gap-2 border-t bg-muted/25 px-5 py-3 text-muted-foreground text-xs leading-relaxed">
				<CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
				<p>
					Failed payments are informational. They are not subtracted because
					they were never counted as revenue.
				</p>
			</div>
		</Card>
	);
}

export type { NetRevenueCardProps };
export { NetRevenueCard };
