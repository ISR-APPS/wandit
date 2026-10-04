/**
 * Columns of the desktop publish log table. `PublicationsDataTable` renders
 * them with the cells of `publication-table-cells.tsx`.
 */
import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table";
import type { AdminPublication } from "@/features/publications/api/publications.dto";

import { PublicationSuspensionAction } from "./publication-suspension-action";
import {
	PublicationLink,
	PublicationPublishedAt,
	PublicationStatusBadge,
	PublicationUser,
} from "./publication-table-cells";

const publicationsTableColumns: ColumnDef<AdminPublication>[] = [
	{
		accessorKey: "publishedAt",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Published" />
		),
		cell: ({ row }) => <PublicationPublishedAt publication={row.original} />,
	},
	{
		id: "user",
		accessorFn: (publication) =>
			`${publication.user.name} ${publication.user.email}`,
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="User" />
		),
		cell: ({ row }) => <PublicationUser publication={row.original} />,
	},
	{
		id: "project",
		accessorFn: (publication) => publication.project.name,
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Project" />
		),
		cell: ({ row }) => (
			<p className="truncate font-medium">{row.original.project.name}</p>
		),
	},
	{
		id: "link",
		accessorKey: "slug",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Link" />
		),
		cell: ({ row }) => <PublicationLink publication={row.original} />,
	},
	{
		accessorKey: "status",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Status" />
		),
		cell: ({ row }) => <PublicationStatusBadge publication={row.original} />,
	},
	{
		id: "actions",
		cell: ({ row }) => (
			<PublicationSuspensionAction publication={row.original} />
		),
	},
];

export { publicationsTableColumns };
