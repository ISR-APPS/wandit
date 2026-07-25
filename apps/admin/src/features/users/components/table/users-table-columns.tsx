import type { ColumnDef, FilterFn } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table";
import { Checkbox } from "@/components/ui/checkbox";
import type { AdminUserSummary } from "@/features/users/api/users.dto";
import {
	formatAdminDate,
	formatCompactNumber,
	formatMinorCurrency,
	formatWholeNumber,
} from "@/features/users/lib/formatters";

import { UserRowActions } from "./user-row-actions";
import {
	AccountBadge,
	PaymentProviderBadge,
	PlanBadge,
	RoleBadge,
	SubscriptionBadge,
	UserIdentity,
} from "./user-table-cells";
import { HIGH_USAGE_TOKEN_THRESHOLD, isNewThisWeek } from "./users-table-utils";

const includesSelectedValue: FilterFn<AdminUserSummary> = (
	row,
	columnId,
	filterValue: string[],
) => filterValue.includes(row.getValue(columnId));

const usersTableColumns: ColumnDef<AdminUserSummary>[] = [
	{
		id: "select",
		header: ({ table }) => (
			<Checkbox
				checked={
					table.getIsAllPageRowsSelected() ||
					(table.getIsSomePageRowsSelected() && "indeterminate")
				}
				onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
				aria-label="Select all users on this page"
			/>
		),
		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				onCheckedChange={(value) => row.toggleSelected(!!value)}
				aria-label={`Select ${row.original.name}`}
			/>
		),
		enableSorting: false,
		enableHiding: false,
		size: 40,
	},
	{
		id: "user",
		accessorFn: (user) => `${user.name} ${user.email} ${user.id}`,
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="User" />
		),
		cell: ({ row }) => <UserIdentity user={row.original} />,
		sortingFn: (rowA, rowB) =>
			rowA.original.name.localeCompare(rowB.original.name),
		enableHiding: false,
		enableResizing: true,
		size: 336,
		minSize: 280,
		maxSize: 480,
	},
	{
		accessorKey: "role",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Role" />
		),
		cell: ({ row }) => <RoleBadge role={row.original.role} />,
		filterFn: includesSelectedValue,
	},
	{
		accessorKey: "plan",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Plan" />
		),
		cell: ({ row }) => <PlanBadge plan={row.original.plan} />,
		filterFn: includesSelectedValue,
	},
	{
		accessorKey: "paymentProvider",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Provider" />
		),
		cell: ({ row }) => (
			<PaymentProviderBadge provider={row.original.paymentProvider} />
		),
		filterFn: includesSelectedValue,
	},
	{
		accessorKey: "subscriptionStatus",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Subscription" />
		),
		cell: ({ row }) => (
			<SubscriptionBadge status={row.original.subscriptionStatus} />
		),
		filterFn: includesSelectedValue,
	},
	{
		accessorKey: "monthlyAmountMinor",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Monthly" />
		),
		cell: ({ row }) => (
			<div>
				<p className="font-medium font-mono tabular-nums">
					{formatMinorCurrency(
						row.original.monthlyAmountMinor,
						row.original.currency,
					)}
				</p>
				{row.original.currency && (
					<p className="text-muted-foreground text-xs">
						{row.original.currency} / month
					</p>
				)}
			</div>
		),
	},
	{
		accessorKey: "renewalAt",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Renewal" />
		),
		cell: ({ row }) => (
			<div>
				<p className="tabular-nums">
					{formatAdminDate(row.original.renewalAt)}
				</p>
				{row.original.subscriptionStatus === "past-due" && (
					<p className="text-amber-700 text-xs dark:text-amber-300">
						Payment overdue
					</p>
				)}
			</div>
		),
	},
	{
		accessorKey: "creditsBalance",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Credits" />
		),
		cell: ({ row }) => (
			<div>
				<p className="font-medium font-mono tabular-nums">
					{formatWholeNumber(row.original.creditsBalance)}
				</p>
				<p className="text-muted-foreground text-xs">available</p>
			</div>
		),
	},
	{
		accessorKey: "tokensLifetime",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Tokens used" />
		),
		cell: ({ row }) => (
			<div>
				<p className="font-medium font-mono tabular-nums">
					{formatCompactNumber(row.original.tokensLifetime)}
				</p>
				<p className="text-muted-foreground text-xs">
					{formatCompactNumber(row.original.tokensThisPeriod)} period ·{" "}
					{formatMinorCurrency(row.original.tokenCostUsdMinor, "USD")}
				</p>
			</div>
		),
	},
	{
		accessorKey: "websitesGenerated",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Websites" />
		),
		cell: ({ row }) => (
			<span className="font-mono tabular-nums">
				{formatWholeNumber(row.original.websitesGenerated)}
			</span>
		),
	},
	{
		accessorKey: "assetsGenerated",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Assets" />
		),
		cell: ({ row }) => (
			<span className="font-mono tabular-nums">
				{formatWholeNumber(row.original.assetsGenerated)}
			</span>
		),
	},
	{
		id: "accountState",
		accessorFn: (user) => (user.isBanned ? "banned" : "active"),
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Account" />
		),
		cell: ({ row }) => <AccountBadge user={row.original} />,
		filterFn: includesSelectedValue,
	},
	{
		accessorKey: "signedUpAt",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Signed up" />
		),
		cell: ({ row }) => (
			<div>
				<p className="tabular-nums">
					{formatAdminDate(row.original.signedUpAt)}
				</p>
				<p className="text-muted-foreground text-xs">
					Seen {formatAdminDate(row.original.lastSeenAt)}
				</p>
			</div>
		),
	},
	{
		accessorKey: "country",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Location" />
		),
		cell: ({ row }) => (
			<div>
				<p>{row.original.country}</p>
				<p className="font-mono text-muted-foreground text-xs">
					{row.original.locale}
				</p>
			</div>
		),
	},
	{
		id: "usageBand",
		accessorFn: (user) =>
			user.tokensLifetime >= HIGH_USAGE_TOKEN_THRESHOLD ? "high" : "standard",
		filterFn: includesSelectedValue,
		enableHiding: false,
		enableSorting: false,
	},
	{
		id: "signupCohort",
		accessorFn: (user) => (isNewThisWeek(user) ? "new" : "existing"),
		filterFn: includesSelectedValue,
		enableHiding: false,
		enableSorting: false,
	},
	{
		id: "actions",
		cell: ({ row }) => <UserRowActions user={row.original} />,
		enableSorting: false,
		enableHiding: false,
		size: 48,
	},
];

export { usersTableColumns };
