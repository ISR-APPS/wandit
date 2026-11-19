// The table card of the home: the open tickets that are urgent or that no agent took yet.
// DashboardPage renders it under the middle grid and passes the rows. The /app loader fills the ticket list.
// It follows the full-width table card of the kit system, with priority and agent filters.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	copyToClipboard,
	DueLabel,
	downloadCsv,
	fillMessage,
	PersonAvatar,
	PriorityBadge,
	TICKET_PRIORITIES,
	toCsv,
} from "~/features/helpdesk";
import { type TicketListItem, ticketCsvColumns } from "~/features/tickets";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";

// Eight rows keep the card near one screen high. The pages show the rest.
const URGENT_PAGE_SIZE = 8;

// The filter value of the tickets with no agent. Agent ids start with "agent-", so it never clashes.
const NO_AGENT = "unassigned";

type UrgentTableCardProps = {
	/** The open urgent or unassigned tickets, the nearest deadline first. */
	tickets: TicketListItem[];
	/** Milliseconds since 1970, read one time by the page. The SLA cells count from it. */
	now: number;
};

/** The filters cut the rows; then RecordTable filters by text, sorts, and pages them. */
export function UrgentTableCard({ tickets, now }: UrgentTableCardProps) {
	const { t, locale } = useT();
	const [priority, setPriority] = useState<string | null>(null);
	const [agent, setAgent] = useState<string | null>(null);
	const agents = [
		...new Map(
			tickets.flatMap((ticket) =>
				ticket.assignee ? [[ticket.assignee.id, ticket.assignee.name]] : [],
			),
		),
	].sort((first, second) => first[1].localeCompare(second[1], locale));
	const rows = tickets.filter(
		(ticket) =>
			(priority === null || ticket.priority === priority) &&
			(agent === null || (ticket.assignee?.id ?? NO_AGENT) === agent),
	);

	const columns: RecordColumn<TicketListItem>[] = [
		{
			id: "subject",
			header: t("tickets.subject"),
			sortValue: (row) => row.subject,
			// justify-items-start: each line is as wide as its text, so dir="auto" text sits at the start side.
			cell: (row) => (
				<div className="grid min-w-56 justify-items-start">
					<Link
						to="/app/tickets/$ticketId"
						params={{ ticketId: row.id }}
						className="font-medium hover:underline"
						dir="auto"
					>
						{row.subject}
					</Link>
					<span className="text-muted-foreground text-xs">
						{`#${row.id} · ${t(`tickets.channels.${row.channel}`)}`}
					</span>
				</div>
			),
		},
		{
			id: "customer",
			header: t("tickets.customer"),
			hideable: true,
			sortValue: (row) => row.customer.name,
			cell: (row) => (
				<div className="grid justify-items-start">
					<span dir="auto">{row.customer.name}</span>
					<span className="text-muted-foreground text-xs" dir="auto">
						{row.requester.name}
					</span>
				</div>
			),
		},
		{
			id: "priority",
			header: t("tickets.priority"),
			sortValue: (row) => TICKET_PRIORITIES.indexOf(row.priority),
			cell: (row) => <PriorityBadge priority={row.priority} />,
		},
		{
			id: "sla",
			header: t("tickets.slaLeft"),
			hideable: true,
			// A paused clock sorts after every deadline.
			sortValue: (row) =>
				row.dueAt === null ? Number.POSITIVE_INFINITY : Date.parse(row.dueAt),
			cell: (row) => <DueLabel dueAt={row.dueAt} now={now} />,
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
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("dashboard.urgentTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("dashboard.urgentDescription"), {
						count: new Intl.NumberFormat(locale).format(tickets.length),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<RecordTable
					rows={rows}
					columns={columns}
					searchText={(row) =>
						`${row.id} ${row.subject} ${row.customer.name} ${row.requester.name}`
					}
					searchPlaceholder={t("tickets.filterPlaceholder")}
					pageSize={URGENT_PAGE_SIZE}
					noResults={t("dashboard.noUrgent")}
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
								label={t("tickets.agent")}
								options={[
									...agents.map(([id, name]) => ({ value: id, label: name })),
									{ value: NO_AGENT, label: t("tickets.unassigned") },
								]}
								value={agent}
								onValueChange={setAgent}
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
			</CardContent>
		</Card>
	);
}
