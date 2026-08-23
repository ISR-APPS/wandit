import type { AdminAnalyticsCredits } from "@wandit/contracts";
import type { LucideIcon } from "lucide-react";
import {
	ActivityIcon,
	CoinsIcon,
	ReceiptIcon,
	ScanSearchIcon,
} from "lucide-react";
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
import { formatOverviewCompactNumber } from "@/features/overview/lib/formatters";

type CreditEconomicsCardProps = {
	credits: AdminAnalyticsCredits;
};

function formatUsd(micros: number): string {
	return (micros / 1_000_000).toLocaleString("en-US", {
		currency: "USD",
		maximumFractionDigits: 2,
		style: "currency",
	});
}

type CreditEconomicsItemProps = {
	icon: LucideIcon;
	label: string;
	value: ReactNode;
	description: string;
	badge: string;
	tooltip: string;
};

function CreditEconomicsItem({
	icon: Icon,
	label,
	value,
	description,
	badge,
	tooltip,
}: CreditEconomicsItemProps) {
	return (
		<div className="flex min-w-0 gap-3 px-6 py-5">
			<span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
				<Icon className="size-4" />
			</span>
			<div className="min-w-0 flex-1">
				<div className="flex min-h-4 items-center gap-1">
					<p className="whitespace-nowrap text-muted-foreground text-xs leading-4">
						{label}
					</p>
					<MetricInfoTooltip label={label} content={tooltip} />
				</div>
				<div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
					<p className="min-w-0 whitespace-nowrap font-semibold text-2xl tabular-nums tracking-tight">
						{value}
					</p>
					<Badge variant="outline" className="ml-auto shrink-0 bg-muted/30">
						{badge}
					</Badge>
				</div>
				<p className="mt-1 text-muted-foreground text-xs tabular-nums leading-relaxed">
					{description}
				</p>
			</div>
		</div>
	);
}

function CreditEconomicsCard({ credits }: CreditEconomicsCardProps) {
	return (
		<Card className="h-full gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<CardTitle>
					<h2>Credit economics</h2>
				</CardTitle>
				<CardDescription>
					Conversion behavior and unit-cost signals
				</CardDescription>
			</CardHeader>

			<CardContent className="grid flex-1 divide-y p-0">
				<CreditEconomicsItem
					icon={ActivityIcon}
					label="Avg. credits before upgrade"
					value={formatOverviewCompactNumber(credits.avgCreditsBeforeUpgrade)}
					description="Credits used before first subscription."
					badge="All time"
					tooltip="Average credits used before a user's first paid subscription. It includes everyone who has ever upgraded."
				/>
				<CreditEconomicsItem
					icon={CoinsIcon}
					label="Provider cost per credit"
					value={
						<>
							{credits.providerCostPerCreditMicros.toLocaleString("en-US", {
								maximumFractionDigits: 2,
							})}{" "}
							<span className="font-medium text-muted-foreground text-sm">
								µUSD
							</span>
						</>
					}
					description="µUSD per credit · 1M µUSD = $1"
					badge="In range"
					tooltip="What one billed credit really costs us in AI provider fees (billable spend over debited credits). Values use micro-US dollars: 1,000,000 µUSD equals $1."
				/>
				<CreditEconomicsItem
					icon={ReceiptIcon}
					label="Provider spend: billable vs total"
					value={
						<>
							{formatUsd(credits.billableProviderCostMicros)}{" "}
							<span className="font-medium text-muted-foreground text-sm">
								of {formatUsd(credits.totalProviderCostMicros)}
							</span>
						</>
					}
					description={`Unbilled (bundled helper calls): ${formatUsd(
						credits.totalProviderCostMicros -
							credits.billableProviderCostMicros,
					)}`}
					badge="In range"
					tooltip="Total is every provider dollar spent on metered operations in range (best-known cost). Billable is the part customers were debited for; historical bundled helper calls cost money against zero charge."
				/>
				<CreditEconomicsItem
					icon={ScanSearchIcon}
					label="Cost provenance"
					value={
						<span className="flex flex-wrap gap-x-3 text-base">
							<span>
								{formatUsd(credits.providerCostByProvenanceMicros.measured)}{" "}
								<span className="font-medium text-muted-foreground text-xs">
									measured
								</span>
							</span>
							<span>
								{formatUsd(credits.providerCostByProvenanceMicros.contract)}{" "}
								<span className="font-medium text-muted-foreground text-xs">
									contract
								</span>
							</span>
							<span>
								{formatUsd(credits.providerCostByProvenanceMicros.estimate)}{" "}
								<span className="font-medium text-muted-foreground text-xs">
									estimate
								</span>
							</span>
						</span>
					}
					description="Where the total spend figure comes from."
					badge="In range"
					tooltip="Measured: reconciled from the gateway's actual charge. Contract: the catalog price snapshotted at settlement. Estimate: the reservation estimate, still awaiting reconciliation."
				/>
			</CardContent>
		</Card>
	);
}

export type { CreditEconomicsCardProps };
export { CreditEconomicsCard };
