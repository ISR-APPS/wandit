// The page of one event: the header with its status, the sales, the run of show, and a rail of facts.
// The /app/events/$eventId route renders it after its loader. The route also uses the skeleton below.
// An unknown id shows a not-found card with a link back to the programme.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { EventStatusBadge } from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { eventQueryOptions } from "../api/events.queries";
import { DoorCard } from "./door-card";
import { EventFactsCard } from "./event-facts-card";
import { LatestOrdersCard } from "./latest-orders-card";
import { RunOfShowCard } from "./run-of-show-card";
import { SalesPaceCard } from "./sales-pace-card";
import { TicketTiersCard } from "./ticket-tiers-card";

type EventDetailPageProps = {
	/** The `$eventId` param of the URL, for example "evt-1013". Any text: an unknown id shows not found. */
	eventId: string;
};

/** A 2/3 main column and a 1/3 rail from the 5xl container width. In one column the facts come first. */
export function EventDetailPage({ eventId }: EventDetailPageProps) {
	const { t } = useT();
	const { data } = useSuspenseQuery(eventQueryOptions(eventId));

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start"
		>
			<Link to="/app/events">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("events.title")}
			</Link>
		</Button>
	);
	if (!data) {
		return (
			<Card className="max-w-lg">
				<CardHeader>
					<CardTitle>{t("events.notFoundTitle")}</CardTitle>
					<CardDescription>{t("events.notFound")}</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild>
						<Link to="/app/events">{t("events.backToEvents")}</Link>
					</Button>
				</CardContent>
			</Card>
		);
	}
	const { event, latestOrders, salesPace, now } = data;
	const hasGuests = event.status !== "announced";

	return (
		<div className="grid gap-6">
			{backLink}
			<PageHeader
				title={event.name}
				description={
					// The note has its own line, so a long note never wraps in the middle of the status line.
					<span className="grid justify-items-start gap-1.5">
						<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
							<EventStatusBadge status={event.status} />
							<span>{t(`events.kinds.${event.kind}`)}</span>
						</span>
						<span dir="auto">{event.note}</span>
					</span>
				}
				actions={
					hasGuests ? (
						<Button asChild variant="outline">
							<Link to="/app/attendees" search={{ event: event.id }}>
								{t("events.openGuestList")}
							</Link>
						</Button>
					) : null
				}
			/>
			{/* In one column the facts come first, so the day, the doors, and the venue show without a scroll. */}
			{/* From 5xl the main column spans both rows. The 1fr row takes its extra height, so no gap opens under the facts. */}
			<div className="grid @5xl/main:grid-cols-3 grid-cols-1 @5xl/main:grid-rows-[auto_1fr] items-start gap-6">
				<div className="@5xl/main:col-start-3 @5xl/main:row-start-1">
					<EventFactsCard event={event} now={now} />
				</div>
				<div className="@5xl/main:col-span-2 @5xl/main:col-start-1 @5xl/main:row-span-2 @5xl/main:row-start-1 grid gap-6">
					<SalesPaceCard event={event} points={salesPace} />
					<RunOfShowCard
						items={event.schedule}
						now={now}
						isCancelled={event.status === "cancelled"}
					/>
				</div>
				<div className="@5xl/main:col-start-3 @5xl/main:row-start-2 grid gap-6">
					<DoorCard event={event} now={now} />
					<TicketTiersCard tiers={event.tierSales} />
					{hasGuests ? (
						<LatestOrdersCard
							eventId={event.id}
							orders={latestOrders}
							now={now}
						/>
					) : null}
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function EventDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-32" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-72" />
				<Skeleton className="h-5 w-96 max-w-full" />
			</div>
			<div className="grid @5xl/main:grid-cols-3 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid gap-6">
					<Skeleton className="h-96" />
					<Skeleton className="h-80" />
				</div>
				<div className="grid gap-6">
					<Skeleton className="h-72" />
					<Skeleton className="h-40" />
				</div>
			</div>
		</div>
	);
}
