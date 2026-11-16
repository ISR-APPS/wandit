// The Next up panel of the home: the open ticket to handle first, large, with its last customer message.
// QueuePage renders it beside the queue. The ticket is the first of openTicketsInOrder: the most overdue, else the soonest due.
import { Link } from "@tanstack/react-router";
import {
	DueLabel,
	FIRST_REPLY_TARGET_MINUTES,
	formatRelativeTime,
	MINUTE_MS,
	PersonAvatar,
	PLAN_BADGE,
	PriorityLabel,
	RESOLUTION_TARGET_MINUTES,
	TicketStatusBadge,
} from "~/features/helpdesk";
import {
	type ClockState,
	SlaClock,
	type TicketListItem,
} from "~/features/tickets";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { ArrowRightIcon } from "~/shared/ui/icons";

type NextUpCardProps = {
	/** The ticket to handle first, or null when no ticket is open. */
	ticket: TicketListItem | null;
	/** Milliseconds since 1970, read one time by the page. */
	now: number;
};

/** The ticket subject as an h2, the requester, a quote of the last customer message, the SLA clock, five facts, and Open. */
export function NextUpCard({ ticket, now }: NextUpCardProps) {
	const { t, locale } = useT();
	if (!ticket) {
		return (
			<Card className="h-full">
				<CardHeader>
					<CardTitle>{t("queue.nextUp")}</CardTitle>
				</CardHeader>
				<CardContent className="grid flex-1 place-items-center py-10 text-center">
					<p className="text-muted-foreground text-sm">
						{t("queue.nothingOpen")}
					</p>
				</CardContent>
			</Card>
		);
	}
	// A new ticket runs the first reply clock. An open ticket runs the resolution clock. A pending ticket pauses both.
	const isNew = ticket.status === "new";
	const clockState: ClockState =
		ticket.status === "pending"
			? { kind: "paused" }
			: {
					kind: "running",
					elapsedMinutes: (now - Date.parse(ticket.createdAt)) / MINUTE_MS,
				};
	const facts = [
		{
			key: "topic",
			label: t("tickets.topic"),
			value: t(`topics.${ticket.topic}`),
		},
		{
			key: "channel",
			label: t("tickets.channel"),
			value: t(`tickets.channels.${ticket.channel}`),
		},
		{
			key: "plan",
			label: t("queue.plan"),
			value: (
				<Badge variant={PLAN_BADGE[ticket.customer.plan]}>
					{t(`customers.plans.${ticket.customer.plan}`)}
				</Badge>
			),
		},
		{
			key: "assignee",
			label: t("tickets.assignee"),
			value: ticket.assignee ? (
				ticket.assignee.name
			) : (
				<span className="text-muted-foreground">{t("tickets.unassigned")}</span>
			),
		},
		{
			key: "waiting",
			label: t("queue.lastUpdate"),
			value: formatRelativeTime(ticket.lastActivityAt, now, locale),
		},
	];
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("queue.nextUp")}</CardTitle>
				<CardAction>
					<TicketStatusBadge status={ticket.status} />
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="grid gap-2">
					<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
						<PriorityLabel priority={ticket.priority} />
						<span className="text-muted-foreground tabular-nums">{`#${ticket.id}`}</span>
						<DueLabel dueAt={ticket.dueAt} now={now} />
					</p>
					<h2 className="font-display font-medium text-xl leading-snug">
						{ticket.subject}
					</h2>
					<p className="flex items-center gap-2 text-muted-foreground text-sm">
						<PersonAvatar name={ticket.requester.name} className="size-6" />
						<span className="min-w-0 truncate">
							<span className="text-foreground">{ticket.requester.name}</span>
							{` · ${ticket.customer.name}`}
						</span>
					</p>
				</div>
				<blockquote
					className="line-clamp-4 rounded-lg bg-muted/60 px-3.5 py-3 text-muted-foreground text-sm leading-relaxed"
					dir="auto"
				>
					{ticket.preview}
				</blockquote>
				<SlaClock
					label={t(isNew ? "tickets.firstReply" : "tickets.resolution")}
					targetMinutes={
						isNew
							? FIRST_REPLY_TARGET_MINUTES[ticket.priority]
							: RESOLUTION_TARGET_MINUTES[ticket.priority]
					}
					state={clockState}
				/>
				{/* In the stacked layout the card is wide, so the facts use two short columns. */}
				<dl className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-1 gap-2.5 @2xl/main:gap-x-10 border-t pt-4 text-sm">
					{facts.map((fact) => (
						<div
							key={fact.key}
							className="flex items-center justify-between gap-3"
						>
							<dt className="text-muted-foreground">{fact.label}</dt>
							<dd className="text-end">{fact.value}</dd>
						</div>
					))}
				</dl>
			</CardContent>
			<CardFooter className="mt-auto">
				<Button asChild className="w-full">
					<Link to="/app/tickets/$ticketId" params={{ ticketId: ticket.id }}>
						{t("queue.openTicket")}
						<ArrowRightIcon className="rtl:rotate-180" />
					</Link>
				</Button>
			</CardFooter>
		</Card>
	);
}
