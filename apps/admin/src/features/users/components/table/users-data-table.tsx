import {
	type Column,
	type ColumnSizingState,
	flexRender,
	getCoreRowModel,
	type Header,
	type PaginationState,
	type Table as TanStackTable,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { SearchXIcon, XIcon } from "lucide-react";
import { type CSSProperties, type KeyboardEvent, useState } from "react";

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
import type {
	AdminListUsersSort,
	AdminUserSummary,
	UserCreditsUsedFilter,
	UserPlanFilter,
	UserRoleFilter,
	UserStatusFilter,
	UserVerifiedFilter,
} from "@/features/users/api/users.dto";
import { cn } from "@/lib/utils";

import { UsersMobileList } from "./users-mobile-list";
import { usersTableColumns } from "./users-table-columns";
import { UsersTableToolbar } from "./users-table-toolbar";

type UsersDataTableProps = {
	data: AdminUserSummary[];
	page: number;
	pageSize: number;
	total: number;
	sort: AdminListUsersSort;
	plan?: UserPlanFilter;
	role?: UserRoleFilter;
	status?: UserStatusFilter;
	verified?: UserVerifiedFilter;
	creditsUsed?: UserCreditsUsedFilter;
	searchValue: string;
	isFetching?: boolean;
	onSearchChange: (value: string) => void;
	onSortChange: (sort: AdminListUsersSort) => void;
	onPlanChange: (plan: UserPlanFilter | undefined) => void;
	onRoleChange: (role: UserRoleFilter | undefined) => void;
	onStatusChange: (status: UserStatusFilter | undefined) => void;
	onVerifiedChange: (verified: UserVerifiedFilter | undefined) => void;
	onCreditsUsedChange: (creditsUsed: UserCreditsUsedFilter | undefined) => void;
	onClearAllFilters: () => void;
	onPageChange: (page: number) => void;
	onPageSizeChange: (pageSize: number) => void;
};

function UsersDataTable({
	data,
	page,
	pageSize,
	total,
	sort,
	plan,
	role,
	status,
	verified,
	creditsUsed,
	searchValue,
	isFetching = false,
	onSearchChange,
	onSortChange,
	onPlanChange,
	onRoleChange,
	onStatusChange,
	onVerifiedChange,
	onCreditsUsedChange,
	onClearAllFilters,
	onPageChange,
	onPageSizeChange,
}: UsersDataTableProps) {
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

	const pagination: PaginationState = {
		pageIndex: Math.max(page - 1, 0),
		pageSize,
	};

	const table = useReactTable({
		data,
		columns: usersTableColumns,
		state: {
			columnVisibility,
			columnSizing,
			pagination,
		},
		defaultColumn: {
			enableResizing: false,
			enableSorting: false,
		},
		enableColumnResizing: true,
		columnResizeMode: "onChange",
		manualPagination: true,
		pageCount: Math.max(Math.ceil(total / pageSize), 1),
		rowCount: total,
		getRowId: (user) => user.id,
		onColumnVisibilityChange: setColumnVisibility,
		onColumnSizingChange: setColumnSizing,
		onPaginationChange: (updater) => {
			const next =
				typeof updater === "function" ? updater(pagination) : updater;

			if (next.pageSize !== pagination.pageSize) {
				onPageSizeChange(next.pageSize);
			} else if (next.pageIndex !== pagination.pageIndex) {
				onPageChange(next.pageIndex + 1);
			}
		},
		getCoreRowModel: getCoreRowModel(),
	});

	const visibleRows = table.getRowModel().rows;
	const isFiltered =
		searchValue.trim().length > 0 ||
		Boolean(
			plan?.length ||
				role?.length ||
				status?.length ||
				verified?.length ||
				creditsUsed,
		);

	return (
		<div className="space-y-4">
			<div className="rounded-xl border bg-background p-3 sm:p-4">
				<UsersTableToolbar
					table={table}
					searchValue={searchValue}
					sort={sort}
					plan={plan}
					role={role}
					status={status}
					verified={verified}
					creditsUsed={creditsUsed}
					onSearchChange={onSearchChange}
					onSortChange={onSortChange}
					onPlanChange={onPlanChange}
					onRoleChange={onRoleChange}
					onStatusChange={onStatusChange}
					onVerifiedChange={onVerifiedChange}
					onCreditsUsedChange={onCreditsUsedChange}
					onClearAllFilters={onClearAllFilters}
				/>
			</div>

			{visibleRows.length > 0 ? (
				<UsersMobileList users={visibleRows.map((row) => row.original)} />
			) : (
				<FilteredEmptyState
					isFiltered={isFiltered}
					onClear={onClearAllFilters}
					className="lg:hidden"
				/>
			)}

			<div
				className={cn(
					"isolate hidden overflow-hidden rounded-xl border bg-background transition-opacity lg:block",
					isFetching && "opacity-60",
				)}
				data-testid="users-table"
			>
				<Table className="min-w-[1320px]">
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
								<TableRow key={row.id} className="group hover:bg-muted">
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
									<FilteredEmptyState
										isFiltered={isFiltered}
										onClear={onClearAllFilters}
									/>
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
	if (columnId === "user") {
		return cn(
			"sticky left-0 z-20 border-r px-4 pr-7",
			isHeader ? "bg-background" : "bg-background group-hover:bg-muted",
		);
	}

	if (columnId === "role") {
		return "min-w-[104px] pr-3 pl-5";
	}

	if (columnId === "status") {
		return "min-w-[184px]";
	}

	if (columnId === "actions") {
		return cn(
			"sticky right-0 z-20 w-14 min-w-14 max-w-14 border-l px-2 text-center",
			isHeader ? "bg-background" : "bg-background group-hover:bg-muted",
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
	isFiltered,
	onClear,
	className,
}: {
	isFiltered: boolean;
	onClear: () => void;
	className?: string;
}) {
	return (
		<Empty className={cn("border-0 py-10", className)}>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<SearchXIcon />
				</EmptyMedia>
				<EmptyTitle>
					{isFiltered
						? "No users match these filters"
						: "No users on this page"}
				</EmptyTitle>
				<EmptyDescription>
					{isFiltered
						? "Try a different search or filter value, or reset them."
						: "Go back to an earlier page of the directory."}
				</EmptyDescription>
			</EmptyHeader>
			{isFiltered && (
				<EmptyContent>
					<Button type="button" variant="outline" size="sm" onClick={onClear}>
						<XIcon data-icon="inline-start" />
						Reset filters
					</Button>
				</EmptyContent>
			)}
		</Empty>
	);
}

export type { UsersDataTableProps };
export { UsersDataTable };
