import type { ColumnDef, FilterFn } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Checkbox } from "@/components/ui/checkbox";
import type { Affiliate } from "@/features/affiliates/api/affiliates.dto";
import { TOP_AFFILIATE_REVENUE_USD_MINOR } from "@/features/affiliates/lib/constants";
import {
	formatAffiliateCompactNumber,
	formatAffiliateCurrency,
	formatAffiliateDate,
	formatAffiliateDateTime,
	formatAffiliateNumber,
	formatAffiliatePercent,
} from "@/features/affiliates/lib/formatters";

import { AffiliateRowActions } from "./affiliate-row-actions";
import {
	AffiliateChannelBadge,
	AffiliateCodesCell,
	AffiliateConversionCell,
	AffiliateIdentity,
	AffiliatePayoutMethodCell,
	AffiliateStatusBadge,
} from "./affiliate-table-cells";
import { getAffiliateSearchValue } from "./affiliates-table-utils";

const includesSelectedValue: FilterFn<Affiliate> = (
	row,
	columnId,
	filterValue: string[],
) => filterValue.includes(String(row.getValue(columnId)));

const includesSearchValue: FilterFn<Affiliate> = (
	row,
	columnId,
	filterValue: string,
) =>
	String(row.getValue(columnId))
		.toLowerCase()
		.includes(filterValue.trim().toLowerCase());

type AffiliatesTableColumnActions = {
	onOpenDetail: (affiliate: Affiliate) => void;
	onAddCode: (affiliate: Affiliate) => void;
};

function createAffiliatesTableColumns({
	onOpenDetail,
	onAddCode,
}: AffiliatesTableColumnActions): ColumnDef<Affiliate>[] {
	return [
		{
			id: "select",
			header: ({ table }) => (
				<Checkbox
					checked={
						table.getIsAllPageRowsSelected() ||
						(table.getIsSomePageRowsSelected() && "indeterminate")
					}
					onCheckedChange={(value) =>
						table.toggleAllPageRowsSelected(Boolean(value))
					}
					aria-label="Select all affiliates on this page"
				/>
			),
			cell: ({ row }) => (
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
					aria-label={`Select ${row.original.name}`}
				/>
			),
			enableSorting: false,
			enableHiding: false,
			size: 48,
		},
		{
			id: "affiliate",
			accessorFn: getAffiliateSearchValue,
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Affiliate" />
			),
			cell: ({ row }) => (
				<AffiliateIdentity
					affiliate={row.original}
					onOpen={() => onOpenDetail(row.original)}
				/>
			),
			filterFn: includesSearchValue,
			size: 310,
			minSize: 280,
			maxSize: 420,
		},
		{
			accessorKey: "status",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Status" />
			),
			cell: ({ row }) => <AffiliateStatusBadge status={row.original.status} />,
			filterFn: includesSelectedValue,
		},
		{
			accessorKey: "channel",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Channel" />
			),
			cell: ({ row }) => (
				<AffiliateChannelBadge channel={row.original.channel} />
			),
			filterFn: includesSelectedValue,
		},
		{
			id: "codes",
			accessorFn: (affiliate) => affiliate.codes.length,
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Referral codes" />
			),
			cell: ({ row }) => (
				<AffiliateCodesCell
					affiliate={row.original}
					onOpen={() => onOpenDetail(row.original)}
				/>
			),
			size: 220,
		},
		{
			id: "traffic",
			accessorFn: (affiliate) => affiliate.performance.uniqueVisitors,
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Traffic" />
			),
			cell: ({ row }) => (
				<div>
					<p className="font-medium font-mono tabular-nums">
						{formatAffiliateCompactNumber(
							row.original.performance.uniqueVisitors,
						)}
					</p>
					<p className="text-muted-foreground text-xs">
						{formatAffiliateCompactNumber(row.original.performance.clicks)}{" "}
						clicks
					</p>
				</div>
			),
		},
		{
			id: "signups",
			accessorFn: (affiliate) => affiliate.performance.signups,
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Signups" />
			),
			cell: ({ row }) => {
				const { signups, uniqueVisitors } = row.original.performance;
				const rate = uniqueVisitors > 0 ? (signups / uniqueVisitors) * 100 : 0;

				return (
					<div>
						<p className="font-medium font-mono tabular-nums">
							{formatAffiliateNumber(signups)}
						</p>
						<p className="text-muted-foreground text-xs">
							{formatAffiliatePercent(rate)} of visitors
						</p>
					</div>
				);
			},
		},
		{
			id: "conversion",
			accessorFn: (affiliate) =>
				affiliate.performance.signups > 0
					? (affiliate.performance.paidConversions /
							affiliate.performance.signups) *
						100
					: 0,
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Paid rate" />
			),
			cell: ({ row }) => <AffiliateConversionCell affiliate={row.original} />,
		},
		{
			id: "revenue",
			accessorFn: (affiliate) => affiliate.performance.revenueUsdMinor,
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Revenue" />
			),
			cell: ({ row }) => (
				<div>
					<p className="font-medium font-mono tabular-nums">
						{formatAffiliateCurrency(row.original.performance.revenueUsdMinor)}
					</p>
					<p className="text-muted-foreground text-xs">reporting USD</p>
				</div>
			),
		},
		{
			id: "commissionDue",
			accessorFn: (affiliate) =>
				affiliate.performance.pendingCommissionUsdMinor,
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Commission due" />
			),
			cell: ({ row }) => (
				<div>
					<p className="font-medium font-mono tabular-nums">
						{formatAffiliateCurrency(
							row.original.performance.pendingCommissionUsdMinor,
						)}
					</p>
					<p className="text-muted-foreground text-xs">
						{formatAffiliatePercent(
							row.original.defaultCommissionRatePercent,
							0,
						)}{" "}
						base rate
					</p>
				</div>
			),
		},
		{
			accessorKey: "payoutMethod",
			accessorFn: (affiliate) => affiliate.payoutMethod ?? "not-set",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Payout" />
			),
			cell: ({ row }) => (
				<AffiliatePayoutMethodCell method={row.original.payoutMethod} />
			),
			filterFn: includesSelectedValue,
		},
		{
			id: "lastConversion",
			accessorFn: getLastConversionAt,
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Last conversion" />
			),
			cell: ({ row }) => (
				<span className="tabular-nums">
					{formatAffiliateDateTime(getLastConversionAt(row.original))}
				</span>
			),
		},
		{
			accessorKey: "joinedAt",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Joined" />
			),
			cell: ({ row }) => (
				<span className="tabular-nums">
					{formatAffiliateDate(row.original.joinedAt)}
				</span>
			),
		},
		{
			id: "performanceBand",
			accessorFn: (affiliate) => {
				if (affiliate.performance.paidConversions === 0) {
					return "no-conversions";
				}
				if (
					affiliate.performance.revenueUsdMinor >=
					TOP_AFFILIATE_REVENUE_USD_MINOR
				) {
					return "top-revenue";
				}
				return "converting";
			},
			filterFn: includesSelectedValue,
			enableHiding: false,
			enableSorting: false,
		},
		{
			id: "payoutBand",
			accessorFn: (affiliate) =>
				affiliate.performance.pendingCommissionUsdMinor > 0 ? "due" : "settled",
			filterFn: includesSelectedValue,
			enableHiding: false,
			enableSorting: false,
		},
		{
			id: "actions",
			cell: ({ row }) => (
				<AffiliateRowActions
					affiliate={row.original}
					onOpenDetail={() => onOpenDetail(row.original)}
					onAddCode={() => onAddCode(row.original)}
				/>
			),
			enableSorting: false,
			enableHiding: false,
			size: 52,
		},
	];
}

function getLastConversionAt(affiliate: Affiliate) {
	let latestValue: string | null = null;
	let latestTimestamp = Number.NEGATIVE_INFINITY;

	for (const code of affiliate.codes) {
		if (!code.lastConversionAt) {
			continue;
		}

		const timestamp = Date.parse(code.lastConversionAt);
		if (Number.isFinite(timestamp) && timestamp > latestTimestamp) {
			latestTimestamp = timestamp;
			latestValue = code.lastConversionAt;
		}
	}

	return latestValue;
}

export type { AffiliatesTableColumnActions };
export { createAffiliatesTableColumns, getLastConversionAt };
