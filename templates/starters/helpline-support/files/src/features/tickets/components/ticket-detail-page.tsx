// The page of one ticket, as an inbox in one card: the views and channels, the ticket list, and the thread.
// The /app/tickets/$ticketId route renders it after its loader. The route also uses the skeleton below.
// It follows the kit mail page. The views pane shows from the 5xl container width, the list from 2xl;
// a phone shows the thread only, and its back button opens the ticket list.
// An unknown ticket number shows a not-found block with a link back to the list.
import {
	ArchiveIcon,
	ChatCircleDotsIcon,
	CheckCircleIcon,
	HourglassMediumIcon,
	SealWarningIcon,
	TicketIcon,
	TrayIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	formatRelativeTime,
	PriorityBadge,
	TICKET_CHANNELS,
	type TicketChannel,
	type TicketStatus,
} from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import {
	CaretLeftIcon,
	type KitIcon,
	MagnifyingGlassIcon,
} from "~/shared/ui/icons";
import { Input } from "~/shared/ui/input";
import { Separator } from "~/shared/ui/separator";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	type TicketListItem,
	ticketQueryOptions,
	ticketsQueryOptions,
} from "../api/tickets.queries";
import { TicketThread } from "./ticket-thread";

// LIMIT: the list pane draws the 60 newest matches; "solved" holds about 400 tickets. Upgrade: a virtual list or server pages.
const LIST_LIMIT = 60;

/** One view of the views pane: every ticket, or one status. */
type TicketView = "all" | TicketStatus;

/** The views, in order, with their icons. The kit mail page lists its folders the same way. */
const VIEWS = [
	{ value: "all", icon: TicketIcon },
	{ value: "new", icon: SealWarningIcon },
	{ value: "open", icon: ChatCircleDotsIcon },
	{ value: "pending", icon: HourglassMediumIcon },
	{ value: "solved", icon: CheckCircleIcon },
	{ value: "closed", icon: ArchiveIcon },
] satisfies { value: TicketView; icon: KitIcon }[];

/** The dot color of each channel in the views pane. The channel name shows next to it. */
const CHANNEL_DOT = {
	email: "bg-chart-1",
	chat: "bg-chart-2",
	web_form: "bg-chart-3",
	phone: "bg-chart-4",
} satisfies Record<TicketChannel, string>;

/** The two tabs of the list pane: every ticket of the view, or only the ones with no agent. */
const LIST_TABS = ["all", "unassigned"] as const;
type ListTab = (typeof LIST_TABS)[number];

type TicketDetailPageProps = {
	/** The `$ticketId` param of the URL: a ticket number as text. */
	ticketId: string;
};

/** The page holds the view, the channel, the tab, and the search of the list pane. The thread reads the ticket query. */
export function TicketDetailPage({ ticketId }: TicketDetailPageProps) {
	const { t, locale } = useT();
	const { data: ticket } = useSuspenseQuery(ticketQueryOptions(ticketId));
	const { data: tickets } = useSuspenseQuery(ticketsQueryOptions());
	// The list opens on the status of this ticket, so the ticket shows in it.
	const [view, setView] = useState<TicketView>(ticket?.status ?? "all");
	const [channel, setChannel] = useState<TicketChannel | null>(null);
	const [tab, setTab] = useState<ListTab>("all");
	const [query, setQuery] = useState("");
	const now = Date.now();
	const number = new Intl.NumberFormat(locale);

	if (!ticket) {
		return (
			<div className="grid justify-items-start gap-4">
				<Button asChild variant="ghost" size="sm" className="-ms-3">
					<Link to="/app/tickets">
						<CaretLeftIcon className="rtl:rotate-180" />
						{t("tickets.title")}
					</Link>
				</Button>
				<p className="text-muted-foreground text-sm">{t("tickets.notFound")}</p>
			</div>
		);
	}

	const inView = (row: TicketListItem) => view === "all" || row.status === view;
	const needle = query.trim().toLocaleLowerCase(locale);
	const matches = tickets.filter(
		(row) =>
			inView(row) &&
			(channel === null || row.channel === channel) &&
			(tab === "all" || row.assignee === null) &&
			(needle === "" ||
				`${row.id} ${row.subject} ${row.requester.name} ${row.customer.name}`
					.toLocaleLowerCase(locale)
					.includes(needle)),
	);
	const listed = matches.slice(0, LIST_LIMIT);
	const position = listed.findIndex((row) => row.id === ticket.id);
	const viewLabel = (value: TicketView) =>
		value === "all" ? t("tickets.all") : t(`tickets.statuses.${value}`);

	return (
		<Card className="h-[calc(100svh-7rem)] min-h-[32rem] flex-row gap-0 overflow-hidden py-0">
			<nav
				aria-label={t("tickets.views")}
				className="@5xl/main:flex hidden w-52 shrink-0 flex-col border-e"
			>
				<p className="flex h-14 shrink-0 items-center gap-2 px-4 font-medium text-sm">
					<TrayIcon className="size-4" />
					{t("tickets.inbox")}
				</p>
				<Separator />
				<ul className="grid gap-1 p-2">
					{VIEWS.map((item) => {
						const isActive = item.value === view;
						const count = tickets.filter(
							(row) => item.value === "all" || row.status === item.value,
						).length;
						return (
							<li key={item.value}>
								<button
									type="button"
									aria-pressed={isActive}
									onClick={() => setView(item.value)}
									className={cn(
										"flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm",
										isActive
											? "bg-primary text-primary-foreground"
											: "hover:bg-accent hover:text-accent-foreground",
									)}
								>
									<item.icon className="size-4" />
									{viewLabel(item.value)}
									<span
										className={cn(
											"ms-auto text-xs tabular-nums",
											!isActive && "rounded-full border px-1.5",
										)}
									>
										{number.format(count)}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
				<Separator />
				<ul className="grid gap-1 p-2">
					{TICKET_CHANNELS.map((value) => {
						const isActive = value === channel;
						return (
							<li key={value}>
								<button
									type="button"
									aria-pressed={isActive}
									// A second click on the chosen channel clears the filter.
									onClick={() => setChannel(isActive ? null : value)}
									className={cn(
										"flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm hover:bg-accent hover:text-accent-foreground",
										isActive && "bg-accent text-accent-foreground",
									)}
								>
									<span
										aria-hidden="true"
										className={cn("size-3 rounded-full", CHANNEL_DOT[value])}
									/>
									{t(`tickets.channels.${value}`)}
									<span className="ms-auto rounded-full border px-1.5 text-xs tabular-nums">
										{number.format(
											tickets.filter(
												(row) => inView(row) && row.channel === value,
											).length,
										)}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			</nav>
			<div className="@2xl/main:flex hidden w-80 shrink-0 flex-col border-e">
				<div className="flex h-14 shrink-0 items-center gap-2 px-4">
					<h1 className="truncate font-display font-semibold text-xl">
						{viewLabel(view)}
					</h1>
					<Tabs
						value={tab}
						onValueChange={(value) =>
							setTab(LIST_TABS.find((option) => option === value) ?? "all")
						}
						className="ms-auto"
					>
						<TabsList>
							{LIST_TABS.map((option) => (
								<TabsTrigger key={option} value={option}>
									{t(`tickets.listTabs.${option}`)}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</div>
				<Separator />
				<div className="relative shrink-0 p-4">
					<MagnifyingGlassIcon className="pointer-events-none absolute start-7 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={t("tickets.searchPlaceholder")}
						aria-label={t("tickets.searchPlaceholder")}
						className="ps-9"
					/>
				</div>
				<ul className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto px-4 pb-4">
					{listed.length === 0 ? (
						<li className="py-8 text-center text-muted-foreground text-sm">
							{t("tickets.noResults")}
						</li>
					) : (
						listed.map((row) => (
							<li
								key={row.id}
								ref={row.id === ticket.id ? revealRow : undefined}
							>
								<Link
									to="/app/tickets/$ticketId"
									params={{ ticketId: row.id }}
									aria-current={row.id === ticket.id ? "page" : undefined}
									className={cn(
										"grid gap-2 rounded-lg border p-3 text-sm hover:bg-accent",
										row.id === ticket.id && "bg-muted",
									)}
								>
									<span className="flex items-center gap-2">
										<bdi className="truncate font-semibold">
											{row.requester.name}
										</bdi>
										{/* A new ticket has no reply yet: the dot marks it, as the kit marks an unread mail. */}
										{row.status === "new" ? (
											<span className="size-2 shrink-0 rounded-full bg-info">
												<span className="sr-only">
													{t("tickets.statuses.new")}
												</span>
											</span>
										) : null}
										<time
											dateTime={row.lastActivityAt}
											className="ms-auto shrink-0 text-muted-foreground text-xs"
										>
											{formatRelativeTime(row.lastActivityAt, now, locale)}
										</time>
									</span>
									<span className="line-clamp-1 font-medium text-xs" dir="auto">
										{row.subject}
									</span>
									<span
										className="line-clamp-2 text-muted-foreground text-xs"
										dir="auto"
									>
										{row.preview}
									</span>
									<span className="flex flex-wrap gap-1.5">
										<PriorityBadge priority={row.priority} />
										<Badge variant="secondary">
											{t(`topics.${row.topic}`)}
										</Badge>
									</span>
								</Link>
							</li>
						))
					)}
				</ul>
			</div>
			<TicketThread
				// The key empties the reply box when another ticket opens.
				key={ticket.id}
				ticket={ticket}
				previousId={position > 0 ? (listed[position - 1]?.id ?? null) : null}
				nextId={position >= 0 ? (listed[position + 1]?.id ?? null) : null}
				now={now}
			/>
		</Card>
	);
}

// The open ticket can sit low in the list pane. Scroll the pane so its row shows.
// "nearest" leaves the pane as it is when the row is already in view.
function revealRow(node: HTMLLIElement | null) {
	node?.scrollIntoView({ block: "nearest" });
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function TicketDetailPageSkeleton() {
	return (
		<Card className="h-[calc(100svh-7rem)] min-h-[32rem] flex-row gap-0 overflow-hidden py-0">
			<div className="@5xl/main:grid hidden w-52 shrink-0 @5xl/main:content-start gap-2 border-e p-2">
				<Skeleton className="h-10" />
				<Skeleton className="h-48" />
			</div>
			<div className="@2xl/main:grid hidden w-80 shrink-0 @2xl/main:content-start gap-3 border-e p-4">
				<Skeleton className="h-9" />
				<Skeleton className="h-28" />
				<Skeleton className="h-28" />
				<Skeleton className="h-28" />
			</div>
			<div className="grid flex-1 content-start gap-4 p-4">
				<Skeleton className="h-9 w-64" />
				<Skeleton className="h-16" />
				<Skeleton className="h-24 w-3/4" />
				<Skeleton className="ms-auto h-24 w-3/4" />
			</div>
		</Card>
	);
}
