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
import { type CSSProperties, type KeyboardEvent, useState } from "react";
import { toast } from "sonner";

import { DataTablePagination } from "@/components/data-table";
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
import type { AdminUserSummary } from "@/features/users/api/users.dto";
import { USER_TABLE_DEFAULT_PAGE_SIZE } from "@/features/users/lib/constants";
import { cn } from "@/lib/utils";

import { UsersMobileList } from "./users-mobile-list";
import { usersTableColumns } from "./users-table-columns";
import { UsersTableToolbar } from "./users-table-toolbar";
import type { UserTablePresetId } from "./users-table-utils";

type UsersDataTableProps = {
	data: AdminUserSummary[];
};

const initialPagination: PaginationState = {
	pageIndex: 0,
	pageSize: USER_TABLE_DEFAULT_PAGE_SIZE,
};

const initialVisibility: VisibilityState = {
	usageBand: false,
	signupCohort: false,
};

function UsersDataTable({ data }: UsersDataTableProps) {
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "signedUpAt", desc: true },
	]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] =
		useState<VisibilityState>(initialVisibility);
	const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
	const [rowSelection, setRowSelection] = useState({});
	const [pagination, setPagination] =
		useState<PaginationState>(initialPagination);
	const [searchValue, setSearchValue] = useState("");
	const [activePreset, setActivePreset] = useState<UserTablePresetId | null>(
		"all",
	);

	const table = useReactTable({
		data,
		columns: usersTableColumns,
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
		getRowId: (user) => user.id,
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
		table.getColumn("user")?.setFilterValue(value || undefined);
		setActivePreset(null);
	}

	function handlePresetChange(preset: UserTablePresetId) {
		setSearchValue("");
		setActivePreset(preset);
		setPagination((current) => ({ ...current, pageIndex: 0 }));

		switch (preset) {
			case "paying":
				setColumnFilters([{ id: "plan", value: ["starter", "pro"] }]);
				break;
			case "staff":
				setColumnFilters([{ id: "role", value: ["admin", "owner"] }]);
				break;
			case "affiliates":
				setColumnFilters([{ id: "role", value: ["affiliate"] }]);
				break;
			case "past-due":
				setColumnFilters([{ id: "subscriptionStatus", value: ["past-due"] }]);
				break;
			case "banned":
				setColumnFilters([{ id: "accountState", value: ["banned"] }]);
				break;
			case "high-usage":
				setColumnFilters([{ id: "usageBand", value: ["high"] }]);
				break;
			case "new-this-week":
				setColumnFilters([{ id: "signupCohort", value: ["new"] }]);
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

	function exportSelectedUsers() {
		const selectedCount = selectedRows.length;
		toast.success(
			`${selectedCount.toLocaleString()} selected ${
				selectedCount === 1 ? "user" : "users"
			} prepared for export`,
		);
	}

	return (
		<div className="space-y-4">
			<div className="rounded-xl border bg-background p-3 sm:p-4">
				<UsersTableToolbar
					table={table}
					data={data}
					searchValue={searchValue}
					activePreset={activePreset}
					onSearchChange={handleSearchChange}
					onPresetChange={handlePresetChange}
					onReset={handleReset}
				/>
			</div>

			{selectedRows.length > 0 && (
				<div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 sm:flex-row sm:items-center">
					<p className="flex-1 font-medium text-sm">
						{selectedRows.length.toLocaleString()}{" "}
						{selectedRows.length === 1 ? "user" : "users"} selected
					</p>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => table.resetRowSelection()}
						>
							<XIcon data-icon="inline-start" />
							Clear
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={exportSelectedUsers}
						>
							<DownloadIcon data-icon="inline-start" />
							Export selected
						</Button>
					</div>
				</div>
			)}

			{visibleRows.length > 0 ? (
				<UsersMobileList rows={visibleRows} />
			) : (
				<FilteredEmptyState onReset={handleReset} className="lg:hidden" />
			)}

			<div
				className="isolate hidden overflow-hidden rounded-xl border bg-background lg:block"
				data-testid="users-table"
			>
				<Table className="min-w-[2100px]">
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
											<UserColumnResizeHandle header={header} table={table} />
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

	if (columnId === "user") {
		return cn(
			"sticky left-12 z-20 border-r px-4 pr-7",
			isHeader
				? "bg-background"
				: "bg-background group-hover:bg-muted group-data-[state=selected]:bg-muted",
		);
	}

	if (columnId === "role") {
		return "min-w-[104px] pr-3 pl-5";
	}

	if (columnId === "paymentProvider") {
		return "min-w-[132px]";
	}

	if (columnId === "accountState") {
		return "min-w-[184px]";
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
	column: Column<AdminUserSummary>,
): CSSProperties | undefined {
	if (column.id !== "user") {
		return undefined;
	}

	const size = column.getSize();

	return {
		width: size,
		minWidth: size,
		maxWidth: size,
	};
}

type UserColumnResizeHandleProps = {
	header: Header<AdminUserSummary, unknown>;
	table: TanStackTable<AdminUserSummary>;
};

function UserColumnResizeHandle({
	header,
	table,
}: UserColumnResizeHandleProps) {
	const column = header.column;
	const minSize = column.columnDef.minSize ?? 280;
	const maxSize = column.columnDef.maxSize ?? 480;

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
			aria-label="Resize User column"
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
				<EmptyTitle>No users match this view</EmptyTitle>
				<EmptyDescription>
					Change the search, remove a facet, or return to the complete user
					directory.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button type="button" variant="outline" size="sm" onClick={onReset}>
					<XIcon data-icon="inline-start" />
					Clear filters
				</Button>
			</EmptyContent>
		</Empty>
	);
}

export type { UsersDataTableProps };
export { UsersDataTable };
