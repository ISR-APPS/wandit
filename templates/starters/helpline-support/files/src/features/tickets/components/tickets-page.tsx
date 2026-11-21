// The ticket list behind login: the page header, the status tabs, then the ticket table with its toolbar.
// The /app/tickets route renders it after its loader. The route also uses the skeleton and the error below.
// The status tab lives in the URL (?status=), so other pages can link to one tab.
// It follows the order list page of the kit system: tabs, filter field, filter buttons, columns, checkboxes, pages.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	CHANNEL_ICON,
	copyToClipboard,
	downloadCsv,
	formatUpdateDate,
	PersonAvatar,
	PriorityBadge,
	TICKET_CHANNELS,
	TICKET_PRIORITIES,
	TICKET_STATUSES,
	TicketStatusBadge,
	toCsv,
} from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	type TicketListItem,
	ticketsQueryOptions,
} from "../api/tickets.queries";
import { ticketCsvColumns } from "../lib/ticket-csv";

const route = getRouteApi("/app/tickets/");

// Ten rows per page, as the order list of the kit.
const TICKETS_PAGE_SIZE = 10;

/** The tab values: "all", then every status in the order of the work. */
const STATUS_TABS = ["all", ...TICKET_STATUSES] as const;

/** The list page. The tab and the filter buttons narrow the rows; then RecordTable searches, sorts, and pages them. */
export function TicketsPage() {
	const { t, locale } = useT();
	const { data: tickets } = useSuspenseQuery(ticketsQueryOptions());
	const { status } = route.useSearch();
	const navigate = route.useNavigate();
	const [priority, setPriority] = useState<string | null>(null);
	const [channel, setChannel] = useState<string | null>(null);
	const now = Date.now();
	const activeTab = status ?? "all";
	const rows = tickets.filter(
		(ticket) =>
			(status === undefined || ticket.status === status) &&
			(priority === null || ticket.priority === priority) &&
			(channel === null || ticket.channel === channel),
	);

	const columns: RecordColumn<TicketListItem>[] = [
		{
			id: "number",
			header: "#",
			cell: (row) => (
				<span className="text-muted-foreground tabular-nums">{`#${row.id}`}</span>
			),
		},
		{
			id: "subject",
			header: t("tickets.subject"),
			cell: (row) => {
				const Icon = CHANNEL_ICON[row.channel];
				return (
					<Link
						to="/app/tickets/$ticketId"
						params={{ ticketId: row.id }}
						className="flex min-w-64 items-center gap-3 hover:underline"
					>
						<span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
							<Icon className="size-5 text-muted-foreground" />
							<span className="sr-only">
								{t(`tickets.channels.${row.channel}`)}
							</span>
						</span>
						<span className="line-clamp-2 max-w-sm" dir="auto">
							{row.subject}
						</span>
					</Link>
				);
			},
		},
		{
			id: "agent",
			header: t("tickets.agent"),
			hideable: true,
			sortValue: (row) => row.assignee?.name ?? "",
			cell: (row) =>
				row.assignee ? (
					<span className="flex items-center gap-2 whitespace-nowrap">
						<PersonAvatar
							name={row.assignee.name}
							tone="agent"
							className="size-6"
						/>
						<bdi>{row.assignee.name}</bdi>
					</span>
				) : (
					<span className="text-muted-foreground">
						{t("tickets.unassigned")}
					</span>
				),
		},
		{
			id: "customer",
			header: t("tickets.customer"),
			hideable: true,
			cell: (row) => (
				<div className="grid justify-items-start">
					<span className="font-medium" dir="auto">
						{row.requester.name}
					</span>
					<span className="text-muted-foreground" dir="auto">
						{row.customer.name}
					</span>
				</div>
			),
		},
		{
			id: "created",
			header: t("tickets.created"),
			hideable: true,
			sortValue: (row) => Date.parse(row.createdAt),
			cell: (row) => (
				<span className="whitespace-nowrap tabular-nums">
					{formatUpdateDate(row.createdAt, now, locale)}
				</span>
			),
		},
		{
			id: "priority",
			header: t("tickets.priority"),
			hideable: true,
			cell: (row) => <PriorityBadge priority={row.priority} />,
		},
		{
			id: "status",
			header: t("tickets.status"),
			sortValue: (row) => TICKET_STATUSES.indexOf(row.status),
			cell: (row) => <TicketStatusBadge status={row.status} />,
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("tickets.title")}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv("tickets.csv", toCsv(rows, ticketCsvColumns(t)))
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			<Tabs
				value={activeTab}
				onValueChange={(value) =>
					navigate({
						search: {
							status: TICKET_STATUSES.find((option) => option === value),
						},
					})
				}
				className="min-w-0 overflow-x-auto"
			>
				<TabsList>
					{STATUS_TABS.map((option) => (
						<TabsTrigger key={option} value={option}>
							{option === "all"
								? t("tickets.all")
								: t(`tickets.statuses.${option}`)}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			<RecordTable
				// A new tab starts on page 1 with no selection.
				key={activeTab}
				rows={rows}
				columns={columns}
				searchText={(row) =>
					`${row.id} ${row.subject} ${row.customer.name} ${row.requester.name}`
				}
				searchPlaceholder={t("tickets.searchPlaceholder")}
				pageSize={TICKETS_PAGE_SIZE}
				noResults={t("tickets.noResults")}
				selectable
				toolbar={
					<>
						<RecordFilter
							label={t("tickets.priority")}
							options={TICKET_PRIORITIES.map((value) => ({
								value,
								label: t(`tickets.priorities.${value}`),
							}))}
							value={priority}
							onValueChange={setPriority}
						/>
						<RecordFilter
							label={t("tickets.channel")}
							options={TICKET_CHANNELS.map((value) => ({
								value,
								label: t(`tickets.channels.${value}`),
							}))}
							value={channel}
							onValueChange={setChannel}
						/>
					</>
				}
				bulkActions={(selectedRows) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv(
								"tickets-selected.csv",
								toCsv(selectedRows, ticketCsvColumns(t)),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem asChild>
							<Link to="/app/tickets/$ticketId" params={{ ticketId: row.id }}>
								{t("tickets.openTicket")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.id, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("tickets.copyNumber")}
						</DropdownMenuItem>
					</>
				)}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function TicketsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-96 max-w-full" />
			<div className="flex flex-wrap gap-2">
				<Skeleton className="h-9 w-full sm:max-w-sm" />
				<Skeleton className="h-9 w-48" />
			</div>
			<div className="grid gap-2 rounded-md border p-2">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-12 w-full" />
				))}
			</div>
		</div>
	);
}

/** Error state of the ticket pages when a loader fails. Try again runs the loader again. */
export function TicketsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("tickets.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
