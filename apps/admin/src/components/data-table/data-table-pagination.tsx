import type { Table } from "@tanstack/react-table";
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronsLeftIcon,
	ChevronsRightIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface DataTablePaginationProps<TData> {
	table: Table<TData>;
}

const PAGE_SIZE_OPTIONS = [10, 20, 25, 30, 40, 50] as const;

function DataTablePagination<TData>({
	table,
}: DataTablePaginationProps<TData>) {
	const pageCount = table.getPageCount();
	const currentPage =
		pageCount === 0 ? 0 : table.getState().pagination.pageIndex + 1;
	const selectedCount = table.getFilteredSelectedRowModel().rows.length;

	return (
		<div className="flex items-center justify-between gap-2 px-2">
			{selectedCount > 0 ? (
				<p className="hidden flex-1 text-muted-foreground text-sm lg:block">
					{selectedCount} of {table.getFilteredRowModel().rows.length} row(s)
					selected.
				</p>
			) : null}
			<div className="ml-auto flex items-center gap-4 lg:gap-8">
				<div className="flex items-center gap-2">
					<p className="hidden font-medium text-sm lg:block">Rows per page</p>
					<Select
						value={`${table.getState().pagination.pageSize}`}
						onValueChange={(value) => table.setPageSize(Number(value))}
					>
						<SelectTrigger size="sm" className="w-[70px]">
							<SelectValue
								placeholder={`${table.getState().pagination.pageSize}`}
							/>
						</SelectTrigger>
						<SelectContent side="top">
							<SelectGroup>
								{PAGE_SIZE_OPTIONS.map((pageSize) => (
									<SelectItem key={pageSize} value={`${pageSize}`}>
										{pageSize}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>
				<p className="flex w-[100px] items-center justify-center font-medium text-sm">
					Page {currentPage} of {pageCount}
				</p>
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						className="hidden lg:flex"
						onClick={() => table.setPageIndex(0)}
						disabled={!table.getCanPreviousPage()}
					>
						<span className="sr-only">Go to first page</span>
						<ChevronsLeftIcon data-icon="inline-start" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						<span className="sr-only">Go to previous page</span>
						<ChevronLeftIcon data-icon="inline-start" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						<span className="sr-only">Go to next page</span>
						<ChevronRightIcon data-icon="inline-start" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						className="hidden lg:flex"
						onClick={() => table.setPageIndex(Math.max(pageCount - 1, 0))}
						disabled={!table.getCanNextPage()}
					>
						<span className="sr-only">Go to last page</span>
						<ChevronsRightIcon data-icon="inline-start" />
					</Button>
				</div>
			</div>
		</div>
	);
}

export type { DataTablePaginationProps };
export { DataTablePagination, PAGE_SIZE_OPTIONS };
