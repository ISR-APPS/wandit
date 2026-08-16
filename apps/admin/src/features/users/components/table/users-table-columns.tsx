import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table";
import type { AdminUserSummary } from "@/features/users/api/users.dto";
import {
	formatAdminDate,
	formatAdminDateTime,
	formatWholeNumber,
} from "@/features/users/lib/formatters";

import { UserRowActions } from "./user-row-actions";
import {
	PlanBadge,
	RoleBadge,
	StatusBadge,
	UserIdentity,
} from "./user-table-cells";

const usersTableColumns: ColumnDef<AdminUserSummary>[] = [
	{
		id: "user",
		accessorFn: (user) => `${user.name} ${user.email} ${user.id}`,
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="User" />
		),
		cell: ({ row }) => <UserIdentity user={row.original} />,
		enableHiding: false,
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
	},
	{
		accessorKey: "plan",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Plan" />
		),
		cell: ({ row }) => <PlanBadge plan={row.original.plan} />,
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
		accessorKey: "creditsConsumed",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Credits used" />
		),
		cell: ({ row }) => (
			<div>
				<p className="font-medium font-mono tabular-nums">
					{formatWholeNumber(row.original.creditsConsumed)}
				</p>
				<p className="text-muted-foreground text-xs">lifetime</p>
			</div>
		),
	},
	{
		accessorKey: "projectsCount",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Projects" />
		),
		cell: ({ row }) => (
			<span className="font-mono tabular-nums">
				{formatWholeNumber(row.original.projectsCount)}
			</span>
		),
	},
	{
		id: "status",
		accessorFn: (user) => (user.banned ? "banned" : "active"),
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Status" />
		),
		cell: ({ row }) => <StatusBadge user={row.original} />,
	},
	{
		accessorKey: "createdAt",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Signed up" />
		),
		cell: ({ row }) => (
			<p className="tabular-nums">{formatAdminDate(row.original.createdAt)}</p>
		),
	},
	{
		accessorKey: "lastSeenAt",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Last seen" />
		),
		cell: ({ row }) => (
			<p className="text-muted-foreground tabular-nums">
				{formatAdminDateTime(row.original.lastSeenAt)}
			</p>
		),
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
