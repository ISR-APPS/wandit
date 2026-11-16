// The queue panel of the home: the open tickets under status tabs, soonest deadline first, at most QUEUE_LIMIT rows.
// QueuePage renders it beside Next up. The Next up ticket leads the All tab with a "Next" mark.
// Under a main width of 36rem, only Ticket and Due stay as columns. The priority word moves under the subject.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	DueLabel,
	OPEN_STATUSES,
	PersonAvatar,
	PriorityLabel,
	TicketStatusBadge,
} from "~/features/helpdesk";
import type { TicketListItem } from "~/features/tickets";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";

import { QUEUE_LIMIT } from "../lib/queue";

// The columns that a phone width hides, so the table fits with no sideways scroll.
const WIDE_ONLY = "hidden @xl/main:table-cell";
// Status needs the most room. The tabs already show it, so it shows only from a main width of 72rem.
const WIDEST_ONLY = "hidden @6xl/main:table-cell";

type OpenQueueCardProps = {
	/** The open tickets in queue order (openTicketsInOrder). The first one is Next up. */
	open: TicketListItem[];
	/** Milliseconds since 1970, read one time by the page. */
	now: number;
};

/** Status tabs with counts, then a table of up to QUEUE_LIMIT rows. The tab is local state. */
export function OpenQueueCard({ open, now }: OpenQueueCardProps) {
	const { t, locale } = useT();
	const [status, setStatus] = useState<(typeof OPEN_STATUSES)[number] | "all">(
		"all",
	);
	const number = new Intl.NumberFormat(locale);
	const nextUpId = open[0]?.id;
	// A tab shows only for a status with open rows.
	const tabs = OPEN_STATUSES.map((value) => ({
		value,
		count: open.filter((ticket) => ticket.status === value).length,
	})).filter((tab) => tab.count > 0);
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const rows = (
		activeStatus === "all"
			? open
			: open.filter((ticket) => ticket.status === activeStatus)
	).slice(0, QUEUE_LIMIT);

	return (
		<Card className="h-full gap-4">
			<CardHeader>
				<CardTitle>{t("queue.queueTitle")}</CardTitle>
				<CardAction>
					{/* min-h-11 gives a 44 px touch area on a phone. The link opens the list on the active tab. */}
					<Button
						asChild
						variant="ghost"
						size="sm"
						className="-me-2 @xl/main:min-h-0 min-h-11"
					>
						<Link
							to="/app/tickets"
							search={{
								status: activeStatus === "all" ? undefined : activeStatus,
							}}
						>
							{t("queue.seeAll")}
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid min-w-0 gap-3">
				<Tabs
					value={activeStatus}
					onValueChange={(value) =>
						setStatus(OPEN_STATUSES.find((option) => option === value) ?? "all")
					}
					className="max-w-full overflow-x-auto"
				>
					<TabsList>
						<TabsTrigger value="all">
							{t("tickets.all")}
							<span className="text-muted-foreground tabular-nums">
								{number.format(open.length)}
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
				{rows.length === 0 ? (
					<p className="py-10 text-center text-muted-foreground text-sm">
						{t("queue.nothingOpen")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("tickets.ticket")}</TableHead>
								<TableHead className={WIDE_ONLY}>
									{t("tickets.priority")}
								</TableHead>
								<TableHead className={WIDE_ONLY}>
									{t("tickets.assignee")}
								</TableHead>
								<TableHead>{t("tickets.due")}</TableHead>
								<TableHead className={WIDEST_ONLY}>
									{t("tickets.status")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((ticket) => (
								<TableRow key={ticket.id}>
									<TableCell className="@xl/main:min-w-56 min-w-0 max-w-80 whitespace-normal">
										{/* The link covers the cell and its padding (after:-inset-2), so a tap anywhere in the cell opens the ticket. */}
										<div className="relative grid justify-items-start gap-0.5">
											{/* On a phone the Next mark wraps under a long subject, so the subject is not cut. */}
											<span className="flex max-w-full flex-wrap @xl/main:flex-nowrap items-center gap-x-2 gap-y-1">
												<Link
													to="/app/tickets/$ticketId"
													params={{ ticketId: ticket.id }}
													className="line-clamp-2 @xl/main:truncate font-medium after:absolute after:-inset-2 hover:underline"
												>
													{ticket.subject}
												</Link>
												{ticket.id === nextUpId ? (
													<Badge variant="outline">{t("queue.next")}</Badge>
												) : null}
											</span>
											<span className="max-w-full @xl/main:truncate text-muted-foreground text-xs">
												<span className="tabular-nums">{`#${ticket.id}`}</span>
												{` · ${ticket.customer.name}`}
												<span className="@xl/main:hidden">
													{` · ${t(`tickets.priorities.${ticket.priority}`)}`}
												</span>
											</span>
										</div>
									</TableCell>
									<TableCell className={WIDE_ONLY}>
										<PriorityLabel priority={ticket.priority} />
									</TableCell>
									<TableCell className={WIDE_ONLY}>
										{ticket.assignee ? (
											<span className="flex items-center gap-2 whitespace-nowrap">
												<PersonAvatar
													name={ticket.assignee.name}
													tone="agent"
													className="size-6"
												/>
												{ticket.assignee.name.split(" ")[0]}
											</span>
										) : (
											<span className="text-muted-foreground">
												{t("tickets.unassigned")}
											</span>
										)}
									</TableCell>
									<TableCell>
										<DueLabel dueAt={ticket.dueAt} now={now} />
									</TableCell>
									<TableCell className={WIDEST_ONLY}>
										<TicketStatusBadge status={ticket.status} />
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
