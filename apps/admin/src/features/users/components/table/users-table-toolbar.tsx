import { ArrowsDownUpIcon } from "@phosphor-icons/react/ArrowsDownUp";
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { DownloadSimpleIcon } from "@phosphor-icons/react/DownloadSimple";
import { XIcon } from "@phosphor-icons/react/X";
import type { Table } from "@tanstack/react-table";

import {
	DataTableFacetedFilter,
	DataTableViewOptions,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type {
	AdminListUsersSort,
	AdminUserSummary,
	UserCreditsUsedRange,
	UserPlanFilter,
	UserPublishedFilter,
	UserRoleFilter,
	UserStatusFilter,
	UserVerifiedFilter,
} from "@/features/users/api/users.dto";
import {
	USER_PLAN_FILTER_OPTIONS,
	USER_PUBLISHED_FILTER_OPTIONS,
	USER_ROLE_FILTER_OPTIONS,
	USER_SORT_OPTION_GROUPS,
	USER_SORT_OPTIONS,
	USER_STATUS_FILTER_OPTIONS,
	USER_VERIFIED_FILTER_OPTIONS,
} from "@/features/users/lib/constants";

import { UsersCreditsUsedFilter } from "./users-credits-used-filter";

type UsersTableToolbarProps = {
	table: Table<AdminUserSummary>;
	searchValue: string;
	sort: AdminListUsersSort;
	plan?: UserPlanFilter;
	role?: UserRoleFilter;
	status?: UserStatusFilter;
	verified?: UserVerifiedFilter;
	published?: UserPublishedFilter;
	creditsUsed?: UserCreditsUsedRange;
	isExporting: boolean;
	onSearchChange: (value: string) => void;
	onSortChange: (sort: AdminListUsersSort) => void;
	onPlanChange: (plan: UserPlanFilter | undefined) => void;
	onRoleChange: (role: UserRoleFilter | undefined) => void;
	onStatusChange: (status: UserStatusFilter | undefined) => void;
	onVerifiedChange: (verified: UserVerifiedFilter | undefined) => void;
	onPublishedChange: (published: UserPublishedFilter | undefined) => void;
	onCreditsUsedChange: (creditsUsed: UserCreditsUsedRange | undefined) => void;
	onClearAllFilters: () => void;
	onExport: () => void;
};

const columnLabels = {
	user: "User",
	role: "Role",
	plan: "Plan",
	creditsBalance: "Credits",
	creditsConsumed: "Credits used",
	projectsCount: "Projects",
	status: "Status",
	createdAt: "Signed up",
	lastSeenAt: "Last seen",
};

function UsersTableToolbar({
	table,
	searchValue,
	sort,
	plan,
	role,
	status,
	verified,
	published,
	creditsUsed,
	isExporting,
	onSearchChange,
	onSortChange,
	onPlanChange,
	onRoleChange,
	onStatusChange,
	onVerifiedChange,
	onPublishedChange,
	onCreditsUsedChange,
	onClearAllFilters,
	onExport,
}: UsersTableToolbarProps) {
	const hasActiveFilters = Boolean(
		searchValue.trim().length > 0 ||
			plan?.length ||
			role?.length ||
			status?.length ||
			verified?.length ||
			published?.length ||
			creditsUsed,
	);
	const activeSortLabel =
		USER_SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Sort";

	return (
		<div className="flex flex-col gap-2 lg:flex-row lg:items-start">
			<div className="flex flex-1 flex-wrap items-center gap-2">
				<Input
					value={searchValue}
					onChange={(event) => onSearchChange(event.target.value)}
					placeholder="Search name or email..."
					aria-label="Search users"
					className="h-8 w-[150px] lg:w-[250px]"
					// Matches the contract's q.max(200) so a long paste cannot 400.
					maxLength={200}
				/>
				<DataTableFacetedFilter
					ariaLabel="Filter by plan"
					title="Plan"
					options={USER_PLAN_FILTER_OPTIONS}
					value={plan ?? []}
					onValueChange={(values) =>
						onPlanChange(values as UserPlanFilter | undefined)
					}
				/>
				<DataTableFacetedFilter
					ariaLabel="Filter by role"
					title="Role"
					options={USER_ROLE_FILTER_OPTIONS}
					value={role ?? []}
					onValueChange={(values) =>
						onRoleChange(values as UserRoleFilter | undefined)
					}
				/>
				<DataTableFacetedFilter
					ariaLabel="Filter by status"
					title="Status"
					options={USER_STATUS_FILTER_OPTIONS}
					value={status ?? []}
					onValueChange={(values) =>
						onStatusChange(values as UserStatusFilter | undefined)
					}
				/>
				<DataTableFacetedFilter
					ariaLabel="Filter by email verification"
					title="Email"
					options={USER_VERIFIED_FILTER_OPTIONS}
					value={verified ?? []}
					onValueChange={(values) =>
						onVerifiedChange(values as UserVerifiedFilter | undefined)
					}
				/>
				<DataTableFacetedFilter
					ariaLabel="Filter by publication state"
					title="Published"
					options={USER_PUBLISHED_FILTER_OPTIONS}
					value={published ?? []}
					onValueChange={(values) =>
						onPublishedChange(values as UserPublishedFilter | undefined)
					}
				/>
				<UsersCreditsUsedFilter
					value={creditsUsed}
					onValueChange={onCreditsUsedChange}
				/>
				{hasActiveFilters ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={onClearAllFilters}
					>
						Reset
						<XIcon data-icon="inline-end" aria-hidden="true" />
					</Button>
				) : null}
			</div>

			<div className="flex items-center gap-2 lg:shrink-0">
				<Button
					type="button"
					variant="outline"
					size="sm"
					aria-label="Export users to Excel"
					disabled={isExporting}
					onClick={onExport}
				>
					{isExporting ? (
						<CircleNotchIcon
							data-icon="inline-start"
							className="animate-spin text-muted-foreground"
							aria-hidden="true"
						/>
					) : (
						<DownloadSimpleIcon
							data-icon="inline-start"
							className="text-muted-foreground"
							aria-hidden="true"
						/>
					)}
					Export
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="sm"
							aria-label="Sort users"
							className="max-w-full"
						>
							<ArrowsDownUpIcon
								data-icon="inline-start"
								className="text-muted-foreground"
								aria-hidden="true"
							/>
							<span className="hidden text-muted-foreground sm:inline">
								Sort:
							</span>
							<span className="truncate">{activeSortLabel}</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="min-w-[220px]">
						<DropdownMenuRadioGroup
							value={sort}
							onValueChange={(value) =>
								onSortChange(value as AdminListUsersSort)
							}
						>
							{USER_SORT_OPTION_GROUPS.map((group, index) => (
								<DropdownMenuGroup key={group.label}>
									{index > 0 ? <DropdownMenuSeparator /> : null}
									<DropdownMenuLabel className="text-muted-foreground">
										{group.label}
									</DropdownMenuLabel>
									{group.options.map((option) => (
										<DropdownMenuRadioItem
											key={option.value}
											value={option.value}
										>
											{option.label}
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuGroup>
							))}
						</DropdownMenuRadioGroup>
					</DropdownMenuContent>
				</DropdownMenu>
				<DataTableViewOptions table={table} columnLabels={columnLabels} />
			</div>
		</div>
	);
}

export type { UsersTableToolbarProps };
export { UsersTableToolbar };
