// The ticket list behind login: the page header, the status tabs, the priority filter, and the searchable table.
// The /app/tickets route renders it after its loader. The route also uses the skeleton and the error below.
// The status tab lives in the URL (?status=), so the home and other pages can link to one tab.
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	DueLabel,
	fillMessage,
	formatRelativeTime,
	isOpenStatus,
	PersonAvatar,
	PriorityLabel,
	TICKET_PRIORITIES,
	TICKET_STATUSES,
	type TicketPriority,
	TicketStatusBadge,
} from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	type TicketListItem,
	ticketsQueryOptions,
} from "../api/tickets.queries";

const route = getRouteApi("/app/tickets/");

// On a phone the first cell fills the visible card width (100cqi minus the card and cell padding).
// From 36rem the other columns show. Up to 56rem the subject stays narrow and wraps to two lines, so five columns fit.
// The cell is relative, so the subject link can cover the whole cell as its tap area.
const FIRST_CELL =
	"relative w-[calc(100cqi-4rem)] @xl/main:w-auto @xl/main:min-w-48 @xl/main:max-w-56 @4xl/main:max-w-md";

/** The list page. The status tab and the priority filter narrow the rows; then DataTable searches, sorts, and pages them. */
export function TicketsPage() {
	const { t, locale } = useT();
	const { data: tickets } = useSuspenseQuery(ticketsQueryOptions());
	const { status } = route.useSearch();
	const navigate = route.useNavigate();
	const [priority, setPriority] = useState<TicketPriority | "all">("all");

	const number = new Intl.NumberFormat(locale);
	const now = Date.now();
	const byPriority =
		priority === "all"
			? tickets
			: tickets.filter((ticket) => ticket.priority === priority);
	// A tab shows only for a status that has rows under the current priority filter.
	const tabs = TICKET_STATUSES.map((value) => ({
		value,
		count: byPriority.filter((ticket) => ticket.status === value).length,
	})).filter((tab) => tab.count > 0);
	const activeStatus =
		status && tabs.some((tab) => tab.value === status) ? status : "all";
	const rows =
		activeStatus === "all"
			? byPriority
			: byPriority.filter((ticket) => ticket.status === activeStatus);
	const openCount = tickets.filter(
		(ticket) => ticket.status === "new" || ticket.status === "open",
	).length;

	const columns: DataTableColumn<TicketListItem>[] = [
		{
			id: "subject",
			header: t("tickets.ticket"),
			sortValue: (row) => Number(row.id),
			// On a phone the cell takes the visible width of the card, so the next column starts off screen.
			// Its third line then shows the status and the due time. The second line ends with the last activity.
			// The link covers the cell and its padding (after:-inset-2), so a tap anywhere in the cell opens the ticket.
			cell: (row) => (
				<div className={FIRST_CELL}>
					<Link
						to="/app/tickets/$ticketId"
						params={{ ticketId: row.id }}
						className="line-clamp-2 @4xl/main:block @4xl/main:truncate whitespace-normal font-medium after:absolute after:-inset-2 hover:underline"
					>
						{row.subject}
					</Link>
					{/* Up to 56rem the line wraps before "updated", so the narrow cell never cuts the time. */}
					<span className="mt-0.5 block @4xl/main:truncate whitespace-normal text-muted-foreground text-xs">
						<span className="tabular-nums">{`#${row.id}`}</span>
						{` · ${row.customer.name} · `}
						<span className="whitespace-nowrap">
							{fillMessage(t("tickets.updatedAgo"), {
								time: formatRelativeTime(row.lastActivityAt, now, locale),
							})}
						</span>
					</span>
					<span className="mt-1.5 flex @xl/main:hidden items-center gap-2 text-xs">
						<TicketStatusBadge status={row.status} />
						{isOpenStatus(row.status) ? (
							<DueLabel dueAt={row.dueAt} now={now} />
						) : null}
					</span>
				</div>
			),
		},
		{
			id: "status",
			header: t("tickets.status"),
			sortValue: (row) => TICKET_STATUSES.indexOf(row.status),
			cell: (row) => <TicketStatusBadge status={row.status} />,
		},
		{
			id: "priority",
			header: t("tickets.priority"),
			sortValue: (row) => TICKET_PRIORITIES.indexOf(row.priority),
			cell: (row) => <PriorityLabel priority={row.priority} />,
		},
		{
			id: "assignee",
			header: t("tickets.assignee"),
			sortValue: (row) => row.assignee?.name ?? "",
			cell: (row) =>
				row.assignee ? (
					<span className="flex items-center gap-2 whitespace-nowrap">
						<PersonAvatar
							name={row.assignee.name}
							tone="agent"
							className="size-6"
						/>
						{/* The first name is enough in a team of six, and it keeps the column narrow. */}
						<span title={row.assignee.name}>
							{row.assignee.name.split(" ")[0]}
						</span>
					</span>
				) : (
					<span className="text-muted-foreground">
						{t("tickets.unassigned")}
					</span>
				),
		},
		{
			id: "due",
			header: t("tickets.due"),
			sortValue: (row) =>
				row.dueAt ? Date.parse(row.dueAt) : Number.POSITIVE_INFINITY,
			cell: (row) =>
				// Open and pending rows show their deadline or "Paused". Solved and closed rows are done, so they get a dash.
				isOpenStatus(row.status) ? (
					<DueLabel dueAt={row.dueAt} now={now} />
				) : (
					<span className="text-muted-foreground">—</span>
				),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("tickets.title")}
				description={fillMessage(t("tickets.description"), {
					total: number.format(tickets.length),
					open: number.format(openCount),
				})}
			/>
			<Card>
				<CardContent>
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) =>
							`${row.id} ${row.subject} ${row.customer.name} ${row.requester.name} ${row.assignee?.name ?? ""}`
						}
						noResults={t("tickets.noResults")}
						toolbar={
							<>
								<Tabs
									value={activeStatus}
									onValueChange={(value) =>
										navigate({
											search: {
												status: TICKET_STATUSES.find(
													(option) => option === value,
												),
											},
										})
									}
									className="max-w-full overflow-x-auto"
								>
									<TabsList>
										<TabsTrigger value="all">
											{t("tickets.all")}
											<span className="text-muted-foreground tabular-nums">
												{number.format(byPriority.length)}
											</span>
										</TabsTrigger>
										{tabs.map((tab) => (
											<TabsTrigger key={tab.value} value={tab.value}>
												{t(`tickets.statuses.${tab.value}`)}
												<span className="text-muted-foreground tabular-nums">
													{number.format(tab.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
								<Select
									value={priority}
									onValueChange={(value) =>
										setPriority(
											TICKET_PRIORITIES.find((option) => option === value) ??
												"all",
										)
									}
								>
									<SelectTrigger
										aria-label={t("tickets.priority")}
										className="w-40"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">
											{t("tickets.allPriorities")}
										</SelectItem>
										{TICKET_PRIORITIES.map((option) => (
											<SelectItem key={option} value={option}>
												{t(`tickets.priorities.${option}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</>
						}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function TicketsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-72" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<div className="flex flex-wrap gap-2">
						<Skeleton className="h-9 w-full sm:max-w-xs" />
						<Skeleton className="h-9 w-80" />
					</div>
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
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
