/**
 * Shows one page of the credit grant log: a table on wide screens and cards on phones.
 * CreditGrantsPage renders it. It uses TanStack Table only for the shared
 * DataTablePagination control; the server does the paging.
 */
import { Link } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	type PaginationState,
	useReactTable,
} from "@tanstack/react-table";
import type { AdminUserRole } from "@wandit/contracts";
import { SearchXIcon } from "lucide-react";

import { DataTablePagination } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
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
import { formatCreditAmount } from "@/lib/credit-format";
import { cn } from "@/lib/utils";

import type { AdminCreditGrant } from "../api/credit-grants.dto";

type CreditGrantsTableProps = {
	grants: AdminCreditGrant[];
	/** 1-based page number of `grants`. */
	page: number;
	pageSize: number;
	/** Number of grants in the whole log, not only on this page. */
	total: number;
	/** True while the next page loads. The old page stays on screen, dimmed. */
	isFetching: boolean;
	onPageChange: (page: number) => void;
	onPageSizeChange: (pageSize: number) => void;
};

const ROLE_LABELS = {
	admin: "Admin",
	support: "Support",
	user: "User",
} as const satisfies Record<AdminUserRole, string>;

const LINK_CLASS_NAME =
	"truncate font-medium text-foreground text-sm outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring";

const GRANT_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
	month: "short",
	year: "numeric",
});

const columns: ColumnDef<AdminCreditGrant>[] = [
	{
		id: "date",
		header: "Date",
		cell: ({ row }) => <GrantDate grant={row.original} />,
	},
	{
		id: "grantedBy",
		header: "Granted by",
		cell: ({ row }) => <GrantedBy grant={row.original} />,
	},
	{
		id: "recipient",
		header: "Recipient",
		cell: ({ row }) => <Recipient grant={row.original} />,
	},
	{
		id: "amount",
		header: () => <span className="block text-right">Amount</span>,
		cell: ({ row }) => <GrantAmount grant={row.original} />,
	},
	{
		id: "note",
		header: "Note",
		cell: ({ row }) => <GrantNote grant={row.original} />,
	},
];

/** Controlled pagination: the parent owns `page` and `pageSize` and refetches on change. */
export function CreditGrantsTable({
	grants,
	page,
	pageSize,
	total,
	isFetching,
	onPageChange,
	onPageSizeChange,
}: CreditGrantsTableProps) {
	const pagination: PaginationState = {
		pageIndex: Math.max(page - 1, 0),
		pageSize,
	};

	const table = useReactTable({
		data: grants,
		columns,
		state: { pagination },
		manualPagination: true,
		pageCount: Math.max(Math.ceil(total / pageSize), 1),
		rowCount: total,
		getRowId: (grant) => grant.id,
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

	const rows = table.getRowModel().rows;

	return (
		<div className="space-y-4">
			<div className={cn("space-y-3 lg:hidden", isFetching && "opacity-60")}>
				{rows.length > 0 ? (
					rows.map((row) => (
						<article
							key={row.id}
							className="space-y-3 rounded-xl border bg-background p-3"
						>
							<div className="flex items-start justify-between gap-3">
								<Recipient grant={row.original} />
								<GrantAmount grant={row.original} />
							</div>
							<GrantedBy grant={row.original} />
							<GrantNote grant={row.original} />
							<GrantDate grant={row.original} />
						</article>
					))
				) : (
					<EmptyPage />
				)}
			</div>

			<div
				className={cn(
					"hidden overflow-hidden rounded-xl border bg-background transition-opacity lg:block",
					isFetching && "opacity-60",
				)}
			>
				<Table className="min-w-[960px]">
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
										{flexRender(
											header.column.columnDef.header,
											header.getContext(),
										)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{rows.length > 0 ? (
							rows.map((row) => (
								<TableRow key={row.id} className="hover:bg-muted">
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id} className="align-top">
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
								<TableCell colSpan={columns.length} className="h-72">
									<EmptyPage />
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

function GrantDate({ grant }: { grant: AdminCreditGrant }) {
	return (
		<time
			dateTime={grant.createdAt}
			className="text-muted-foreground text-sm tabular-nums"
		>
			{GRANT_DATE_FORMAT.format(new Date(grant.createdAt))}
		</time>
	);
}

function GrantedBy({ grant }: { grant: AdminCreditGrant }) {
	if (grant.grantedBy === null) {
		return <p className="text-muted-foreground text-sm">Unknown account</p>;
	}

	return (
		<div className="min-w-0 space-y-1">
			<div className="flex min-w-0 items-center gap-2">
				<Link
					to="/users/$userId"
					params={{ userId: grant.grantedBy.id }}
					className={LINK_CLASS_NAME}
				>
					{grant.grantedBy.name}
				</Link>
				<Badge variant="outline">{ROLE_LABELS[grant.grantedBy.role]}</Badge>
			</div>
			<p className="truncate text-muted-foreground text-xs">
				{grant.grantedBy.email}
			</p>
		</div>
	);
}

function Recipient({ grant }: { grant: AdminCreditGrant }) {
	if (grant.recipient.kind === "organization") {
		return (
			<div className="flex min-w-0 items-center gap-2">
				<Link
					to="/organizations/$organizationId"
					params={{ organizationId: grant.recipient.id }}
					className={LINK_CLASS_NAME}
				>
					{grant.recipient.name}
				</Link>
				<Badge variant="secondary">Organization</Badge>
			</div>
		);
	}

	return (
		<div className="min-w-0 space-y-1">
			<Link
				to="/users/$userId"
				params={{ userId: grant.recipient.id }}
				className={cn("block", LINK_CLASS_NAME)}
			>
				{grant.recipient.name}
			</Link>
			<p className="truncate text-muted-foreground text-xs">
				{grant.recipient.email}
			</p>
		</div>
	);
}

function GrantAmount({ grant }: { grant: AdminCreditGrant }) {
	return (
		<p className="whitespace-nowrap text-right font-medium text-sm tabular-nums">
			+{formatCreditAmount(grant.amount)}
		</p>
	);
}

function GrantNote({ grant }: { grant: AdminCreditGrant }) {
	return (
		<p className="max-w-80 whitespace-pre-wrap break-words text-muted-foreground text-sm">
			{grant.note ?? "—"}
		</p>
	);
}

function EmptyPage() {
	return (
		<Empty className="border-0 py-10">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<SearchXIcon />
				</EmptyMedia>
				<EmptyTitle>No grants on this page</EmptyTitle>
				<EmptyDescription>
					Go back to an earlier page of the log.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}
