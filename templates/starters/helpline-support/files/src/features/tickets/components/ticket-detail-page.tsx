// The page of one ticket: the header, the conversation with the other tickets of the company, and a rail.
// The rail holds the ticket facts, the SLA clocks, and the customer.
// The /app/tickets/$ticketId route renders it after its loader. The route also uses the skeleton below.
// An unknown ticket number shows a not-found block with a link back to the list.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { TicketStatusBadge } from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { ticketQueryOptions } from "../api/tickets.queries";
import { ConversationCard } from "./conversation-card";
import { RelatedTicketsCard } from "./related-tickets-card";
import { SlaCard } from "./sla-card";
import { TicketCustomerCard } from "./ticket-customer-card";
import { TicketDetailsCard } from "./ticket-details-card";

type TicketDetailPageProps = {
	/** The `$ticketId` param of the URL: a ticket number as text. */
	ticketId: string;
};

/** The detail page. A 2/3 main column and a 1/3 rail from the 5xl container width. */
export function TicketDetailPage({ ticketId }: TicketDetailPageProps) {
	const { t } = useT();
	const { data: ticket } = useSuspenseQuery(ticketQueryOptions(ticketId));

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start"
		>
			<Link to="/app/tickets">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("tickets.title")}
			</Link>
		</Button>
	);
	if (!ticket) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">{t("tickets.notFound")}</p>
			</div>
		);
	}

	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				{backLink}
				<PageHeader
					title={ticket.subject}
					description={
						<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
							<TicketStatusBadge status={ticket.status} />
							<span className="tabular-nums">{`#${ticket.id}`}</span>
							<span aria-hidden="true">·</span>
							<span>{ticket.customer.name}</span>
							<span aria-hidden="true">·</span>
							<span>{t(`topics.${ticket.topic}`)}</span>
						</span>
					}
				/>
			</div>
			{/* On a phone the rail comes before the other tickets. From 5xl the rail spans both rows on the end side. */}
			{/* The second row takes the spare height, so the other tickets sit right under the conversation. */}
			<div className="grid @5xl/main:grid-cols-3 @5xl/main:grid-rows-[auto_1fr] items-start gap-6">
				<div className="@5xl/main:col-span-2 min-w-0">
					<ConversationCard ticket={ticket} />
				</div>
				<div className="@5xl/main:row-span-2 grid min-w-0 gap-6">
					<TicketDetailsCard ticket={ticket} />
					<SlaCard ticket={ticket} />
					<TicketCustomerCard ticket={ticket} />
				</div>
				<div className="@5xl/main:col-span-2 min-w-0">
					<RelatedTicketsCard ticket={ticket} />
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function TicketDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-24" />
				<Skeleton className="h-8 w-80 max-w-full" />
				<Skeleton className="h-5 w-64 max-w-full" />
			</div>
			<div className="grid @5xl/main:grid-cols-3 items-start gap-6">
				<Skeleton className="@5xl/main:col-span-2 h-[32rem]" />
				<div className="grid gap-6">
					<Skeleton className="h-72" />
					<Skeleton className="h-44" />
				</div>
			</div>
		</div>
	);
}
