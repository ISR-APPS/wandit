import {
	type Column,
	type ColumnFiltersState,
	type ColumnSizingState,
	flexRender,
	getCoreRowModel,
	getFacetedRowModel,
	getFacetedUniqueValues,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type Header,
	type PaginationState,
	type SortingState,
	type Table as TanStackTable,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { DownloadIcon, ListFilterIcon, XIcon } from "lucide-react";
import {
	type CSSProperties,
	type KeyboardEvent,
	useMemo,
	useState,
} from "react";
import { toast } from "sonner";

import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { Affiliate } from "@/features/affiliates/api/affiliates.dto";
import { AffiliateDetailSheet } from "@/features/affiliates/components/affiliate-detail-sheet";
import { CreateAffiliateCodeDialog } from "@/features/affiliates/components/create-affiliate-code-dialog";
import { AFFILIATE_TABLE_DEFAULT_PAGE_SIZE } from "@/features/affiliates/lib/constants";
import { cn } from "@/lib/utils";

import { AffiliatesMobileList } from "./affiliates-mobile-list";
import { createAffiliatesTableColumns } from "./affiliates-table-columns";
import { AffiliatesTableToolbar } from "./affiliates-table-toolbar";
import type { AffiliateTablePresetId } from "./affiliates-table-utils";

type AffiliatesDataTableProps = {
	data: Affiliate[];
};

const initialPagination: PaginationState = {
	pageIndex: 0,
	pageSize: AFFILIATE_TABLE_DEFAULT_PAGE_SIZE,
};

const initialVisibility: VisibilityState = {
	joinedAt: false,
	performanceBand: false,
	payoutBand: false,
};

function AffiliatesDataTable({ data }: AffiliatesDataTableProps) {
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "revenue", desc: true },
	]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] =
		useState<VisibilityState>(initialVisibility);
	const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
	const [rowSelection, setRowSelection] = useState({});
	const [pagination, setPagination] =
		useState<PaginationState>(initialPagination);
	const [searchValue, setSearchValue] = useState("");
	const [activePreset, setActivePreset] =
		useState<AffiliateTablePresetId | null>("all");
	const [selectedAffiliateId, setSelectedAffiliateId] = useState<string | null>(
		null,
	);
	const [addCodeTarget, setAddCodeTarget] = useState<Affiliate | null>(null);

	const columns = useMemo(
		() =>
			createAffiliatesTableColumns({
				onOpenDetail: (affiliate) => setSelectedAffiliateId(affiliate.id),
				onAddCode: setAddCodeTarget,
			}),
		[],
	);

	const table = useReactTable({
		data,
		columns,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			columnSizing,
			rowSelection,
			pagination,
		},
		defaultColumn: {
			enableResizing: false,
		},
		enableColumnResizing: true,
		columnResizeMode: "onChange",
		enableRowSelection: true,
		getRowId: (affiliate) => affiliate.id,
		onSortingChange: setSorting,
		onColumnFiltersChange: (updater) => {
			setColumnFilters(updater);
			setActivePreset(null);
			setPagination((current) => ({ ...current, pageIndex: 0 }));
		},
		onColumnVisibilityChange: setColumnVisibility,
		onColumnSizingChange: setColumnSizing,
		onRowSelectionChange: setRowSelection,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
	});

	const visibleRows = table.getRowModel().rows;
	const selectedRows = table.getFilteredSelectedRowModel().rows;

	function handleSearchChange(value: string) {
		setSearchValue(value);
		table.getColumn("affiliate")?.setFilterValue(value || undefined);
		setActivePreset(null);
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}

	function handlePresetChange(preset: AffiliateTablePresetId) {
		setSearchValue("");
		setActivePreset(preset);
		setPagination((current) => ({ ...current, pageIndex: 0 }));

		switch (preset) {
			case "active":
				setColumnFilters([{ id: "status", value: ["active"] }]);
				break;
			case "top-performers":
				setColumnFilters([{ id: "performanceBand", value: ["top-revenue"] }]);
				setSorting([{ id: "revenue", desc: true }]);
				break;
			case "payout-due":
				setColumnFilters([{ id: "payoutBand", value: ["due"] }]);
				setSorting([{ id: "commissionDue", desc: true }]);
				break;
			case "paused":
				setColumnFilters([{ id: "status", value: ["paused"] }]);
				break;
			case "pending":
				setColumnFilters([{ id: "status", value: ["pending"] }]);
				break;
			case "no-conversions":
				setColumnFilters([
					{ id: "performanceBand", value: ["no-conversions"] },
				]);
				break;
			case "all":
				setColumnFilters([]);
				break;
		}
	}

	function handleReset() {
		setSearchValue("");
		setColumnFilters([]);
		setActivePreset("all");
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}

	function exportSelectedAffiliates() {
		const selectedCount = selectedRows.length;
		toast.success(
			`${selectedCount.toLocaleString()} selected ${
				selectedCount === 1 ? "affiliate" : "affiliates"
			} prepared for export.`,
		);
	}

	return (
		<>
			<div className="space-y-4">
				<div className="rounded-xl border bg-background p-3 sm:p-4">
					<AffiliatesTableToolbar
						table={table}
						data={data}
						searchValue={searchValue}
						activePreset={activePreset}
						onSearchChange={handleSearchChange}
						onPresetChange={handlePresetChange}
						onReset={handleReset}
					/>
				</div>

				{selectedRows.length > 0 ? (
					<div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 sm:flex-row sm:items-center">
						<p className="flex-1 font-medium text-sm">
							{selectedRows.length.toLocaleString()}{" "}
							{selectedRows.length === 1 ? "affiliate" : "affiliates"} selected
						</p>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => table.resetRowSelection()}
							>
								<XIcon />
								Clear
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={exportSelectedAffiliates}
							>
								<DownloadIcon />
								Export selected
							</Button>
						</div>
					</div>
				) : null}

				{visibleRows.length > 0 ? (
					<AffiliatesMobileList
						rows={visibleRows}
						onOpenDetail={(affiliate) => setSelectedAffiliateId(affiliate.id)}
						onAddCode={setAddCodeTarget}
					/>
				) : (
					<FilteredEmptyState onReset={handleReset} className="lg:hidden" />
				)}

				<div
					className="isolate hidden overflow-hidden rounded-xl border bg-background lg:block"
					data-testid="affiliates-table"
				>
					<Table className="min-w-[1740px]">
						<TableHeader>
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id}>
									{headerGroup.headers.map((header) => (
										<TableHead
											key={header.id}
											colSpan={header.colSpan}
											data-column={header.column.id}
											className={getStickyClass(header.column.id, true)}
											style={getColumnSizeStyle(header.column)}
										>
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
											{header.column.getCanResize() ? (
												<AffiliateColumnResizeHandle
													header={header}
													table={table}
												/>
											) : null}
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{visibleRows.length > 0 ? (
								visibleRows.map((row) => (
									<TableRow
										key={row.id}
										data-state={row.getIsSelected() ? "selected" : undefined}
										className="group hover:bg-muted data-[state=selected]:bg-muted"
									>
										{row.getVisibleCells().map((cell) => (
											<TableCell
												key={cell.id}
												data-column={cell.column.id}
												className={getStickyClass(cell.column.id, false)}
												style={getColumnSizeStyle(cell.column)}
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
								<TableRow>
									<TableCell
										colSpan={table.getVisibleLeafColumns().length}
										className="h-72"
									>
										<FilteredEmptyState onReset={handleReset} />
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>

				<DataTablePagination table={table} />
			</div>

			<AffiliateDetailSheet
				affiliateId={selectedAffiliateId}
				open={Boolean(selectedAffiliateId)}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) {
						setSelectedAffiliateId(null);
					}
				}}
			/>

			{addCodeTarget ? (
				<CreateAffiliateCodeDialog
					affiliateId={addCodeTarget.id}
					affiliateName={addCodeTarget.name}
					defaultCommissionRatePercent={
						addCodeTarget.defaultCommissionRatePercent
					}
					open
					onOpenChange={(nextOpen) => {
						if (!nextOpen) {
							setAddCodeTarget(null);
						}
					}}
				/>
			) : null}
		</>
	);
}

function getStickyClass(columnId: string, isHeader: boolean) {
	if (columnId === "select") {
		return cn(
			"sticky left-0 z-30 w-12 min-w-12 max-w-12 border-r",
			isHeader
				? "bg-background"
				: "bg-background group-hover:bg-muted group-data-[state=selected]:bg-muted",
		);
	}

	if (columnId === "affiliate") {
		return cn(
			"sticky left-12 z-20 border-r px-4 pr-6",
			isHeader
				? "bg-background"
				: "bg-background group-hover:bg-muted group-data-[state=selected]:bg-muted",
		);
	}

	if (columnId === "status") {
		return "min-w-[105px] pl-5";
	}

	if (columnId === "codes") {
		return "min-w-[220px]";
	}

	if (columnId === "actions") {
		return cn(
			"sticky right-0 z-20 w-14 min-w-14 max-w-14 border-l px-2 text-center",
			isHeader
				? "bg-background"
				: "bg-background group-hover:bg-muted group-data-[state=selected]:bg-muted",
		);
	}

	return undefined;
}

function getColumnSizeStyle(
	column: Column<Affiliate>,
): CSSProperties | undefined {
	if (column.id !== "affiliate") {
		return undefined;
	}

	const size = column.getSize();
	return {
		width: size,
		minWidth: size,
		maxWidth: size,
	};
}

type AffiliateColumnResizeHandleProps = {
	header: Header<Affiliate, unknown>;
	table: TanStackTable<Affiliate>;
};

function AffiliateColumnResizeHandle({
	header,
	table,
}: AffiliateColumnResizeHandleProps) {
	const column = header.column;
	const minSize = column.columnDef.minSize ?? 280;
	const maxSize = column.columnDef.maxSize ?? 420;

	function handleKeyDown(event: KeyboardEvent<HTMLHRElement>) {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			column.resetSize();
			return;
		}

		const direction =
			event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
		if (direction === 0) {
			return;
		}

		event.preventDefault();
		const step = event.shiftKey ? 24 : 8;
		const nextSize = Math.min(
			maxSize,
			Math.max(minSize, column.getSize() + direction * step),
		);

		table.setColumnSizing((current) => ({
			...current,
			[column.id]: nextSize,
		}));
	}

	return (
		<hr
			tabIndex={0}
			aria-label="Resize Affiliate column"
			aria-orientation="vertical"
			aria-valuemax={maxSize}
			aria-valuemin={minSize}
			aria-valuenow={column.getSize()}
			data-resizing={column.getIsResizing()}
			className="absolute inset-y-0 -right-3 z-40 m-0 w-6 cursor-col-resize touch-none select-none border-0 outline-none after:absolute after:inset-y-2 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border after:transition-colors after:content-[''] hover:after:w-0.5 hover:after:bg-foreground/50 focus-visible:after:w-0.5 focus-visible:after:bg-ring data-[resizing=true]:after:w-0.5 data-[resizing=true]:after:bg-primary"
			title="Drag to resize. Double-click or press Enter to reset."
			onDoubleClick={() => column.resetSize()}
			onKeyDown={handleKeyDown}
			onMouseDown={header.getResizeHandler()}
			onTouchStart={header.getResizeHandler()}
		/>
	);
}

function FilteredEmptyState({
	onReset,
	className,
}: {
	onReset: () => void;
	className?: string;
}) {
	return (
		<Empty className={cn("border-0 py-10", className)}>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<ListFilterIcon />
				</EmptyMedia>
				<EmptyTitle>No affiliates match this view</EmptyTitle>
				<EmptyDescription>
					Change the search, remove a facet, or return to the complete partner
					directory.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button type="button" variant="outline" size="sm" onClick={onReset}>
					<XIcon />
					Clear filters
				</Button>
			</EmptyContent>
		</Empty>
	);
}

export type { AffiliatesDataTableProps };
export { AffiliatesDataTable };
