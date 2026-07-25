import type { Column } from "@tanstack/react-table";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	ChevronsUpDownIcon,
	EyeOffIcon,
} from "lucide-react";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface DataTableColumnHeaderProps<TData, TValue>
	extends React.HTMLAttributes<HTMLDivElement> {
	column: Column<TData, TValue>;
	title: string;
}

function DataTableColumnHeader<TData, TValue>({
	column,
	title,
	className,
}: DataTableColumnHeaderProps<TData, TValue>) {
	if (!column.getCanSort()) {
		return <div className={cn(className)}>{title}</div>;
	}

	const sortDirection = column.getIsSorted();
	const SortIcon =
		sortDirection === "desc"
			? ArrowDownIcon
			: sortDirection === "asc"
				? ArrowUpIcon
				: ChevronsUpDownIcon;

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="-ml-3 h-8 data-[state=open]:bg-accent"
					>
						<span>{title}</span>
						<SortIcon data-icon="inline-end" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					<DropdownMenuGroup>
						<DropdownMenuItem onSelect={() => column.toggleSorting(false)}>
							<ArrowUpIcon />
							Ascending
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => column.toggleSorting(true)}>
							<ArrowDownIcon />
							Descending
						</DropdownMenuItem>
					</DropdownMenuGroup>
					{column.getCanHide() && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuGroup>
								<DropdownMenuItem
									onSelect={() => column.toggleVisibility(false)}
								>
									<EyeOffIcon />
									Hide column
								</DropdownMenuItem>
							</DropdownMenuGroup>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

export type { DataTableColumnHeaderProps };
export { DataTableColumnHeader };
