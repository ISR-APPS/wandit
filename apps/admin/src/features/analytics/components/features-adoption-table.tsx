import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import type { AdminAnalyticsFeature } from "@wandit/contracts";
import { ActivityIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTableColumnHeader } from "@/components/data-table";
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
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { InlinePercentageBar } from "@/features/analytics/components/inline-percentage-bar";
import {
	featureAdoptionMetadata,
	formatNullableAnalyticsMetric,
	orderFeatureAdoptionRows,
} from "@/features/analytics/lib/analytics-data";
import {
	formatOverviewCompactNumber,
	formatOverviewPercentValue,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";
import { cn } from "@/lib/utils";

type FeatureAdoptionTableProps = {
	features: AdminAnalyticsFeature[];
	activeUsersInRange: number;
};

const featureColumns: ColumnDef<AdminAnalyticsFeature>[] = [
	{
		accessorKey: "key",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Feature" />
		),
		cell: ({ row }) => {
			const metadata = featureAdoptionMetadata[row.original.key];

			return (
				<div className="flex items-center gap-3">
					<span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 font-semibold text-muted-foreground text-xs tracking-wide">
						{metadata.mark}
					</span>
					<span>
						<span className="flex items-center gap-1 font-medium">
							{metadata.label}
							{metadata.tooltip ? (
								<MetricInfoTooltip
									label={metadata.label}
									content={metadata.tooltip}
								/>
							) : null}
						</span>
						<span className="block text-muted-foreground text-xs">
							{metadata.description}
						</span>
					</span>
				</div>
			);
		},
	},
	{
		accessorKey: "users",
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title="Users"
				className="justify-end"
			/>
		),
		cell: ({ row }) => (
			<span className="block text-right font-medium tabular-nums">
				{formatOverviewWholeNumber(row.original.users)}
			</span>
		),
	},
	{
		accessorKey: "pctOfActiveUsers",
		header: ({ column }) => (
			<div className="flex items-center gap-1">
				<DataTableColumnHeader column={column} title="Active-user share" />
				<MetricInfoTooltip
					label="Active-user share"
					content="Share of active users who used this feature during the selected range."
				/>
			</div>
		),
		cell: ({ row }) => {
			const metadata = featureAdoptionMetadata[row.original.key];
			const percentage = row.original.pctOfActiveUsers;

			return (
				<div className="flex min-w-44 items-center gap-3">
					<div className="min-w-24 flex-1">
						<InlinePercentageBar
							value={percentage}
							label={`${metadata.label} share of active users`}
						/>
					</div>
					<span className="w-12 text-right font-medium tabular-nums">
						{formatOverviewPercentValue(percentage)}
					</span>
				</div>
			);
		},
	},
	{
		accessorKey: "uses",
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title="Uses"
				className="justify-end"
			/>
		),
		cell: ({ row }) => (
			<span className="block text-right font-medium tabular-nums">
				{formatOverviewWholeNumber(row.original.uses)}
			</span>
		),
	},
	{
		accessorKey: "avgUsesPerUser",
		header: ({ column }) => (
			<div className="flex items-center justify-end gap-1">
				<DataTableColumnHeader
					column={column}
					title="Avg. / user"
					className="justify-end"
				/>
				<MetricInfoTooltip
					label="Avg. / user"
					content="Average number of times each user used this feature during the selected range."
				/>
			</div>
		),
		cell: ({ row }) => (
			<span className="block text-right font-medium tabular-nums">
				{formatOverviewCompactNumber(row.original.avgUsesPerUser)}
			</span>
		),
	},
	{
		accessorKey: "usersToPaidPct",
		header: ({ column }) => (
			<div className="flex items-center justify-end gap-1">
				<DataTableColumnHeader
					column={column}
					title="Users to paid"
					className="justify-end"
				/>
				<MetricInfoTooltip
					label="Users to paid"
					content="Share of this feature's users who were on a paid plan by the end of the selected range."
				/>
			</div>
		),
		cell: ({ row }) => (
			<span className="block text-right font-medium tabular-nums">
				{formatOverviewPercentValue(row.original.usersToPaidPct)}
			</span>
		),
	},
	{
		accessorKey: "convertedAfterUsePct",
		header: ({ column }) => (
			<div className="flex items-center justify-end gap-1">
				<DataTableColumnHeader
					column={column}
					title="Converted after use"
					className="justify-end"
				/>
				<MetricInfoTooltip
					label="Converted after use"
					content="Of the users who used this feature in the range, the share whose first subscription started after their first use."
				/>
			</div>
		),
		cell: ({ row }) => (
			<span className="block text-right font-medium tabular-nums">
				{formatNullableAnalyticsMetric(
					row.original.convertedAfterUsePct,
					formatOverviewPercentValue,
				)}
			</span>
		),
	},
];

const rightAlignedColumns = new Set([
	"users",
	"uses",
	"avgUsesPerUser",
	"usersToPaidPct",
	"convertedAfterUsePct",
]);

function getColumnClassName(columnId: string) {
	return cn(
		columnId === "key" && "min-w-52 pl-6",
		columnId === "pctOfActiveUsers" && "min-w-56",
		rightAlignedColumns.has(columnId) && "min-w-28 text-right",
		columnId === "convertedAfterUsePct" && "min-w-44 pr-6",
	);
}

function FeatureAdoptionTable({
	features,
	activeUsersInRange,
}: FeatureAdoptionTableProps) {
	const orderedFeatures = useMemo(
		() => orderFeatureAdoptionRows(features),
		[features],
	);
	const [sorting, setSorting] = useState<SortingState>([]);
	const table = useReactTable({
		data: orderedFeatures,
		columns: featureColumns,
		state: { sorting },
		enableHiding: false,
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getRowId: (feature) => feature.key,
	});

	return (
		<Card className="gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-[200px] flex-1">
						<CardTitle>
							<h2>Feature adoption</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							Usage and paid conversion by product workflow
						</CardDescription>
					</div>
					<Badge
						variant="outline"
						className="shrink-0 bg-muted/30 tabular-nums"
					>
						{formatOverviewWholeNumber(activeUsersInRange)} active users
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				<Table className="min-w-[1120px]">
					<TableCaption className="sr-only">
						Feature adoption, usage, paid status, and conversion after use in
						the selected range.
					</TableCaption>
					<TableHeader className="bg-muted/20">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id} className="hover:bg-transparent">
								{headerGroup.headers.map((header) => {
									const sorted = header.column.getIsSorted();

									return (
										<TableHead
											key={header.id}
											className={getColumnClassName(header.column.id)}
											aria-sort={
												sorted === "asc"
													? "ascending"
													: sorted === "desc"
														? "descending"
														: "none"
											}
										>
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
										</TableHead>
									);
								})}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows.length > 0 ? (
							table.getRowModel().rows.map((row) => (
								<TableRow key={row.id}>
									{row.getVisibleCells().map((cell) => (
										<TableCell
											key={cell.id}
											className={getColumnClassName(cell.column.id)}
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow className="hover:bg-transparent">
								<TableCell colSpan={featureColumns.length} className="h-56">
									<div className="flex flex-col items-center justify-center px-6 text-center">
										<span className="flex size-10 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
											<ActivityIcon className="size-5" />
										</span>
										<p className="mt-3 font-medium text-sm">
											No feature use recorded in this range
										</p>
										<p className="mt-1 max-w-sm text-muted-foreground text-xs">
											Adoption by workflow will appear after users create,
											publish, or connect something.
										</p>
									</div>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

export type { FeatureAdoptionTableProps };
export { FeatureAdoptionTable };
