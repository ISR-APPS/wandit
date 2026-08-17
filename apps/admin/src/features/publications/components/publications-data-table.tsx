import {
	flexRender,
	getCoreRowModel,
	type PaginationState,
	useReactTable,
} from "@tanstack/react-table";
import { SearchXIcon } from "lucide-react";

import { DataTablePagination } from "@/components/data-table";
import {
	Empty,
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
import type { AdminPublication } from "@/features/publications/api/publications.dto";
import { cn } from "@/lib/utils";

import { PublicationsMobileList } from "./publications-mobile-list";
import { publicationsTableColumns } from "./publications-table-columns";

type PublicationsDataTableProps = {
	data: AdminPublication[];
	page: number;
	pageSize: number;
	total: number;
	isFetching?: boolean;
	onPageChange: (page: number) => void;
	onPageSizeChange: (pageSize: number) => void;
};

function PublicationsDataTable({
	data,
	page,
	pageSize,
	total,
	isFetching = false,
	onPageChange,
	onPageSizeChange,
}: PublicationsDataTableProps) {
	const pagination: PaginationState = {
		pageIndex: Math.max(page - 1, 0),
		pageSize,
	};

	const table = useReactTable({
		data,
		columns: publicationsTableColumns,
		state: {
			pagination,
		},
		defaultColumn: {
			enableSorting: false,
		},
		manualPagination: true,
		pageCount: Math.max(Math.ceil(total / pageSize), 1),
		rowCount: total,
		getRowId: (publication) => publication.id,
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

	return (
		<div className="space-y-4">
			{visibleRows.length > 0 ? (
				<PublicationsMobileList
					publications={visibleRows.map((row) => row.original)}
				/>
			) : (
				<PageEmptyState className="lg:hidden" />
			)}

			<div
				className={cn(
					"hidden overflow-hidden rounded-xl border bg-background transition-opacity lg:block",
					isFetching && "opacity-60",
				)}
				data-testid="publications-table"
			>
				<Table className="min-w-[960px]">
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id} colSpan={header.colSpan}>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{visibleRows.length > 0 ? (
							visibleRows.map((row) => (
								<TableRow key={row.id} className="hover:bg-muted">
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
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
									<PageEmptyState />
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

function PageEmptyState({ className }: { className?: string }) {
	return (
		<Empty className={cn("border-0 py-10", className)}>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<SearchXIcon />
				</EmptyMedia>
				<EmptyTitle>No publications on this page</EmptyTitle>
				<EmptyDescription>
					Go back to an earlier page of the log.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

export type { PublicationsDataTableProps };
export { PublicationsDataTable };
