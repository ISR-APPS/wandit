// The key facts of one ticket: requester, assignee, priority, channel, topic, creation, rating, and help article.
// TicketDetailPage renders it at the top of its rail. The article link opens the article on the Articles page.
import { Link } from "@tanstack/react-router";
import { PersonAvatar, PriorityLabel } from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { TicketDetail } from "../api/tickets.queries";

type TicketDetailsCardProps = {
	ticket: TicketDetail;
};

/** A definition list in two columns: the label at the start, the value at the end. */
export function TicketDetailsCard({ ticket }: TicketDetailsCardProps) {
	const { t, locale } = useT();
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const rows = [
		{
			key: "requester",
			label: t("tickets.requester"),
			value: (
				<span className="grid justify-items-end">
					<span className="font-medium">{ticket.requester.name}</span>
					<span className="text-muted-foreground text-xs">
						{ticket.requester.title}
					</span>
				</span>
			),
		},
		{
			key: "email",
			label: t("tickets.email"),
			value: <span className="break-all">{ticket.requester.email}</span>,
		},
		{
			key: "assignee",
			label: t("tickets.assignee"),
			value: ticket.assignee ? (
				<span className="flex items-center gap-2">
					<PersonAvatar
						name={ticket.assignee.name}
						tone="agent"
						className="size-6"
					/>
					{ticket.assignee.name}
				</span>
			) : (
				<span className="text-muted-foreground">{t("tickets.unassigned")}</span>
			),
		},
		{
			key: "priority",
			label: t("tickets.priority"),
			value: <PriorityLabel priority={ticket.priority} />,
		},
		{
			key: "channel",
			label: t("tickets.channel"),
			value: t(`tickets.channels.${ticket.channel}`),
		},
		{
			key: "topic",
			label: t("tickets.topic"),
			value: t(`topics.${ticket.topic}`),
		},
		{
			key: "created",
			label: t("tickets.created"),
			value: dateTime.format(new Date(ticket.createdAt)),
		},
		...(ticket.rating
			? [
					{
						key: "rating",
						label: t("tickets.rating"),
						value: (
							<Badge
								variant={ticket.rating === "good" ? "success" : "destructive"}
							>
								{t(`tickets.ratings.${ticket.rating}`)}
							</Badge>
						),
					},
				]
			: []),
	];
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("tickets.details")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				<dl className="grid gap-3 text-sm">
					{rows.map((row) => (
						<div
							key={row.key}
							className="flex items-start justify-between gap-4"
						>
							<dt className="shrink-0 text-muted-foreground">{row.label}</dt>
							<dd className="min-w-0 text-end">{row.value}</dd>
						</div>
					))}
				</dl>
				{ticket.article ? (
					// The link covers the block (after:inset-0), so the label also opens the article.
					<div className="relative grid gap-1 border-t pt-4 text-sm">
						<p className="text-muted-foreground">
							{t("tickets.linkedArticle")}
						</p>
						<Link
							to="/app/articles"
							search={{ article: ticket.article.id }}
							className="font-medium after:absolute after:inset-0 hover:underline"
						>
							{ticket.article.title}
						</Link>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
