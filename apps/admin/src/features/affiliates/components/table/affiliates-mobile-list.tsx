import type { Row } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Affiliate } from "@/features/affiliates/api/affiliates.dto";
import {
	formatAffiliateCompactNumber,
	formatAffiliateCurrency,
	formatAffiliateNumber,
	formatAffiliatePercent,
} from "@/features/affiliates/lib/formatters";

import { AffiliateRowActions } from "./affiliate-row-actions";
import {
	AffiliateCodesCell,
	AffiliateIdentity,
	AffiliateStatusBadge,
} from "./affiliate-table-cells";

type AffiliatesMobileListProps = {
	rows: Row<Affiliate>[];
	onOpenDetail: (affiliate: Affiliate) => void;
	onAddCode: (affiliate: Affiliate) => void;
};

function AffiliatesMobileList({
	rows,
	onOpenDetail,
	onAddCode,
}: AffiliatesMobileListProps) {
	return (
		<div className="space-y-3 lg:hidden">
			{rows.map((row) => {
				const affiliate = row.original;
				const { performance } = affiliate;

				return (
					<article
						key={affiliate.id}
						data-state={row.getIsSelected() ? "selected" : undefined}
						className="overflow-hidden rounded-xl border bg-background data-[state=selected]:border-primary/35 data-[state=selected]:bg-muted/35"
					>
						<div className="flex items-center gap-3 border-b p-3">
							<Checkbox
								checked={row.getIsSelected()}
								onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
								aria-label={`Select ${affiliate.name}`}
							/>
							<div className="min-w-0 flex-1">
								<AffiliateIdentity
									affiliate={affiliate}
									onOpen={() => onOpenDetail(affiliate)}
								/>
							</div>
							<AffiliateRowActions
								affiliate={affiliate}
								onOpenDetail={() => onOpenDetail(affiliate)}
								onAddCode={() => onAddCode(affiliate)}
							/>
						</div>

						<div className="flex items-center justify-between gap-3 border-b px-3 py-2.5">
							<AffiliateStatusBadge status={affiliate.status} />
							<AffiliateCodesCell
								affiliate={affiliate}
								onOpen={() => onOpenDetail(affiliate)}
							/>
						</div>

						<div className="grid grid-cols-2 divide-x border-b">
							<MobileDatum label="Unique visitors">
								<p className="font-medium font-mono tabular-nums">
									{formatAffiliateCompactNumber(performance.uniqueVisitors)}
								</p>
								<p className="text-muted-foreground text-xs">
									{formatAffiliateCompactNumber(performance.clicks)} clicks
								</p>
							</MobileDatum>
							<MobileDatum label="Referred signups">
								<p className="font-medium font-mono tabular-nums">
									{formatAffiliateNumber(performance.signups)}
								</p>
							</MobileDatum>
						</div>

						<div className="grid grid-cols-2 divide-x border-b">
							<MobileDatum label="Paid conversions">
								<p className="font-medium font-mono tabular-nums">
									{formatAffiliateNumber(performance.paidConversions)}
								</p>
								<p className="text-muted-foreground text-xs">
									{formatAffiliatePercent(
										performance.signups > 0
											? (performance.paidConversions / performance.signups) *
													100
											: 0,
									)}{" "}
									of signups
								</p>
							</MobileDatum>
							<MobileDatum label="Attributed revenue">
								<p className="font-medium font-mono tabular-nums">
									{formatAffiliateCurrency(performance.revenueUsdMinor)}
								</p>
								<p className="text-muted-foreground text-xs">reporting USD</p>
							</MobileDatum>
						</div>

						<div className="flex items-center justify-between gap-3 px-3 py-2.5">
							<div className="min-w-0">
								<p className="text-muted-foreground text-xs">Commission due</p>
								<p className="font-medium font-mono text-sm tabular-nums">
									{formatAffiliateCurrency(
										performance.pendingCommissionUsdMinor,
									)}
								</p>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => onOpenDetail(affiliate)}
							>
								Manage codes
								<Badge variant="secondary" className="rounded-sm px-1.5">
									{affiliate.codes.length}
								</Badge>
							</Button>
						</div>
					</article>
				);
			})}
		</div>
	);
}

function MobileDatum({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="min-w-0 space-y-1 px-3 py-3">
			<p className="text-muted-foreground text-xs">{label}</p>
			<div className="min-w-0 text-sm">{children}</div>
		</div>
	);
}

export type { AffiliatesMobileListProps };
export { AffiliatesMobileList };
