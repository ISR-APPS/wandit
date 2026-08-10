import type { Table } from "@tanstack/react-table";
import {
	ArrowUpDownIcon,
	SearchIcon,
	ShieldCheckIcon,
	XIcon,
} from "lucide-react";
import { useState } from "react";

import { DataTableViewOptions } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type {
	AdminListUsersSort,
	AdminUserSummary,
} from "@/features/users/api/users.dto";
import { BulkGrantAccessDialog } from "@/features/users/components/bulk-grant-access-dialog";
import { USER_SORT_OPTIONS } from "@/features/users/lib/constants";

type UsersTableToolbarProps = {
	table: Table<AdminUserSummary>;
	searchValue: string;
	sort: AdminListUsersSort;
	onSearchChange: (value: string) => void;
	onSortChange: (sort: AdminListUsersSort) => void;
};

const columnLabels = {
	user: "User",
	role: "Role",
	plan: "Plan",
	creditsBalance: "Credits",
	projectsCount: "Projects",
	status: "Status",
	createdAt: "Signed up",
	lastSeenAt: "Last seen",
};

function UsersTableToolbar({
	table,
	searchValue,
	sort,
	onSearchChange,
	onSortChange,
}: UsersTableToolbarProps) {
	const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
	const selectedUserIds = table
		.getFilteredSelectedRowModel()
		.rows.map((row) => row.original.id);
	const selectedCount = selectedUserIds.length;

	return (
		<>
			<div className="flex flex-col gap-3">
				{selectedCount > 0 ? (
					<div className="hidden items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 lg:flex">
						<p className="font-medium text-sm">{selectedCount} selected</p>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								size="sm"
								onClick={() => setBulkDialogOpen(true)}
							>
								<ShieldCheckIcon data-icon="inline-start" aria-hidden="true" />
								Grant access
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => table.resetRowSelection()}
							>
								Clear
							</Button>
						</div>
					</div>
				) : null}

				<div className="flex flex-col gap-2 xl:flex-row xl:items-center">
					<div className="relative w-full sm:w-[300px]">
						<SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={searchValue}
							onChange={(event) => onSearchChange(event.target.value)}
							placeholder="Search name or email..."
							aria-label="Search users"
							className="h-8 pr-9 pl-9"
							// Matches the contract's q.max(200) so a long paste cannot 400.
							maxLength={200}
						/>
						{searchValue.length > 0 && (
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								className="absolute top-1/2 right-1 size-6 -translate-y-1/2"
								onClick={() => onSearchChange("")}
							>
								<XIcon className="size-3.5" />
								<span className="sr-only">Clear search</span>
							</Button>
						)}
					</div>

					<div className="flex flex-1 flex-wrap items-center gap-2">
						<Select
							value={sort}
							onValueChange={(value) =>
								onSortChange(value as AdminListUsersSort)
							}
						>
							<SelectTrigger size="sm" className="h-8 w-[160px]">
								<ArrowUpDownIcon
									className="size-3.5 text-muted-foreground"
									aria-hidden="true"
								/>
								<SelectValue placeholder="Sort" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectLabel>Sort by</SelectLabel>
									{USER_SORT_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</div>

					<DataTableViewOptions table={table} columnLabels={columnLabels} />
				</div>
			</div>

			<BulkGrantAccessDialog
				userIds={selectedUserIds}
				open={bulkDialogOpen}
				onOpenChange={setBulkDialogOpen}
				onSuccess={() => table.resetRowSelection()}
			/>
		</>
	);
}

export type { UsersTableToolbarProps };
export { UsersTableToolbar };
