import {
	BadgeDollarSignIcon,
	ChartNoAxesCombinedIcon,
	HandshakeIcon,
	Link2Icon,
	ReceiptTextIcon,
	UserRoundCheckIcon,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { Affiliate } from "@/features/affiliates/api/affiliates.dto";
import {
	formatAffiliateCompactCurrency,
	formatAffiliateNumber,
	formatAffiliatePercent,
} from "@/features/affiliates/lib/formatters";

type AffiliatesSummaryStripProps = {
	affiliates: Affiliate[];
};

const summaryItems = [
	{ key: "affiliates", label: "Affiliate partners", icon: HandshakeIcon },
	{ key: "codes", label: "Referral codes", icon: Link2Icon },
	{ key: "signups", label: "Referred signups", icon: UserRoundCheckIcon },
	{
		key: "conversions",
		label: "Paid conversions",
		icon: ChartNoAxesCombinedIcon,
	},
	{
		key: "revenue",
		label: "Attributed revenue",
		icon: BadgeDollarSignIcon,
	},
	{ key: "commission", label: "Commission due", icon: ReceiptTextIcon },
] as const;

function AffiliatesSummaryStrip({ affiliates }: AffiliatesSummaryStripProps) {
	const totalPerformance = affiliates.reduce(
		(total, affiliate) => ({
			signups: total.signups + affiliate.performance.signups,
			paidConversions:
				total.paidConversions + affiliate.performance.paidConversions,
			revenueUsdMinor:
				total.revenueUsdMinor + affiliate.performance.revenueUsdMinor,
			pendingCommissionUsdMinor:
				total.pendingCommissionUsdMinor +
				affiliate.performance.pendingCommissionUsdMinor,
		}),
		{
			signups: 0,
			paidConversions: 0,
			revenueUsdMinor: 0,
			pendingCommissionUsdMinor: 0,
		},
	);
	const activeAffiliates = affiliates.filter(
		(affiliate) => affiliate.status === "active",
	).length;
	const allCodes = affiliates.flatMap((affiliate) => affiliate.codes);
	const activeCodes = allCodes.filter(
		(code) => code.status === "active",
	).length;
	const paidRate =
		totalPerformance.signups > 0
			? (totalPerformance.paidConversions / totalPerformance.signups) * 100
			: 0;

	const values: Record<(typeof summaryItems)[number]["key"], string> = {
		affiliates: formatAffiliateNumber(affiliates.length),
		codes: formatAffiliateNumber(allCodes.length),
		signups: formatAffiliateNumber(totalPerformance.signups),
		conversions: formatAffiliateNumber(totalPerformance.paidConversions),
		revenue: formatAffiliateCompactCurrency(totalPerformance.revenueUsdMinor),
		commission: formatAffiliateCompactCurrency(
			totalPerformance.pendingCommissionUsdMinor,
		),
	};

	const descriptions: Record<(typeof summaryItems)[number]["key"], string> = {
		affiliates: `${activeAffiliates.toLocaleString()} active partners`,
		codes: `${activeCodes.toLocaleString()} active across the program`,
		signups: "Attributed by referral code",
		conversions: `${formatAffiliatePercent(paidRate)} of referred signups`,
		revenue: "Reporting USD equivalent",
		commission: "Pending next payout run",
	};

	return (
		<div className="overflow-hidden rounded-xl border bg-border">
			<div className="grid grid-cols-2 gap-px sm:grid-cols-3 xl:grid-cols-6">
				{summaryItems.map((item) => (
					<div
						key={item.key}
						className="flex min-w-0 items-start gap-3 bg-background p-4"
					>
						<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
							<item.icon className="size-4" />
						</div>
						<div className="min-w-0">
							<p className="truncate text-muted-foreground text-xs">
								{item.label}
							</p>
							<p className="mt-0.5 font-semibold text-xl tabular-nums tracking-tight">
								{values[item.key]}
							</p>
							<p className="mt-1 truncate text-muted-foreground text-xs">
								{descriptions[item.key]}
							</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function AffiliatesSummaryStripSkeleton() {
	return (
		<div className="overflow-hidden rounded-xl border bg-border">
			<div className="grid grid-cols-2 gap-px sm:grid-cols-3 xl:grid-cols-6">
				{summaryItems.map((item) => (
					<div
						key={item.key}
						className="flex items-start gap-3 bg-background p-4"
					>
						<Skeleton className="size-8 shrink-0" />
						<div className="space-y-2">
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-6 w-16" />
							<Skeleton className="h-3 w-28" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

export type { AffiliatesSummaryStripProps };
export { AffiliatesSummaryStrip, AffiliatesSummaryStripSkeleton };
