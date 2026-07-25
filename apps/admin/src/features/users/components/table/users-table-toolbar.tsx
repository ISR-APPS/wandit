import type { Table } from "@tanstack/react-table";
import { SearchIcon, XIcon } from "lucide-react";

import {
	DataTableFacetedFilter,
	DataTableViewOptions,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminUserSummary } from "@/features/users/api/users.dto";
import {
	USER_BANNED_OPTIONS,
	USER_PAYMENT_PROVIDER_OPTIONS,
	USER_PLAN_OPTIONS,
	USER_ROLE_OPTIONS,
	USER_SUBSCRIPTION_STATUS_OPTIONS,
} from "@/features/users/lib/constants";
import { cn } from "@/lib/utils";

import {
	matchesPreset,
	USER_TABLE_PRESETS,
	type UserTablePresetId,
} from "./users-table-utils";

type UsersTableToolbarProps = {
	table: Table<AdminUserSummary>;
	data: AdminUserSummary[];
	searchValue: string;
	activePreset: UserTablePresetId | null;
	onSearchChange: (value: string) => void;
	onPresetChange: (preset: UserTablePresetId) => void;
	onReset: () => void;
};

const columnLabels = {
	user: "User",
	role: "Role",
	plan: "Plan",
	paymentProvider: "Payment provider",
	subscriptionStatus: "Subscription",
	monthlyAmountMinor: "Monthly amount",
	renewalAt: "Renewal",
	creditsBalance: "Credits",
	tokensLifetime: "Tokens used",
	websitesGenerated: "Websites",
	assetsGenerated: "Assets",
	accountState: "Account",
	signedUpAt: "Signed up",
	country: "Location",
};

function UsersTableToolbar({
	table,
	data,
	searchValue,
	activePreset,
	onSearchChange,
	onPresetChange,
	onReset,
}: UsersTableToolbarProps) {
	const isFiltered =
		searchValue.length > 0 || table.getState().columnFilters.length > 0;

	return (
		<div className="space-y-3">
			<fieldset className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-1">
				<legend className="sr-only">Saved user views</legend>
				{USER_TABLE_PRESETS.map((preset) => {
					const count = data.filter((user) =>
						matchesPreset(user, preset.id),
					).length;
					const isActive = activePreset === preset.id;

					return (
						<Button
							key={preset.id}
							type="button"
							size="sm"
							variant={isActive ? "secondary" : "ghost"}
							className={cn(
								"h-8 shrink-0 px-2.5 text-muted-foreground active:scale-[0.98]",
								isActive && "text-foreground",
							)}
							aria-pressed={isActive}
							onClick={() => onPresetChange(preset.id)}
						>
							{preset.label}
							<span
								className={cn(
									"rounded-sm px-1.5 py-0.5 font-mono text-[10px]",
									isActive ? "bg-background/80" : "bg-muted",
								)}
							>
								{count}
							</span>
						</Button>
					);
				})}
			</fieldset>

			<div className="flex flex-col gap-2 xl:flex-row xl:items-center">
				<div className="relative w-full sm:w-[300px]">
					<SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={searchValue}
						onChange={(event) => onSearchChange(event.target.value)}
						placeholder="Search name, email, or ID..."
						aria-label="Search users"
						className="h-8 pl-9"
					/>
				</div>

				<div className="flex flex-1 flex-wrap items-center gap-2">
					{table.getColumn("role") && (
						<DataTableFacetedFilter
							column={table.getColumn("role")}
							title="Role"
							options={[...USER_ROLE_OPTIONS]}
						/>
					)}
					{table.getColumn("plan") && (
						<DataTableFacetedFilter
							column={table.getColumn("plan")}
							title="Plan"
							options={[...USER_PLAN_OPTIONS]}
						/>
					)}
					{table.getColumn("paymentProvider") && (
						<DataTableFacetedFilter
							column={table.getColumn("paymentProvider")}
							title="Provider"
							options={[...USER_PAYMENT_PROVIDER_OPTIONS]}
						/>
					)}
					{table.getColumn("subscriptionStatus") && (
						<DataTableFacetedFilter
							column={table.getColumn("subscriptionStatus")}
							title="Subscription"
							options={[...USER_SUBSCRIPTION_STATUS_OPTIONS]}
						/>
					)}
					{table.getColumn("accountState") && (
						<DataTableFacetedFilter
							column={table.getColumn("accountState")}
							title="Account"
							options={[...USER_BANNED_OPTIONS]}
						/>
					)}
					{isFiltered && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-8"
							onClick={onReset}
						>
							<XIcon data-icon="inline-start" />
							Reset
						</Button>
					)}
				</div>

				<DataTableViewOptions table={table} columnLabels={columnLabels} />
			</div>
		</div>
	);
}

export type { UsersTableToolbarProps };
export { UsersTableToolbar };
