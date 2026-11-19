// The page of one event: a back link, the header with the status and the guest list action, then two tabs.
// Overview: the profile, tiers, and facilities cards on 1/3; the sales chart, run of show, orders, and buyers on 2/3.
// Orders: every order in a table. The /app/events/$eventId route renders it; an unknown id shows a not-found card.
// It follows the kit "profile" page. The sales chart loads with React.lazy, so recharts stays out of the first script.
import { UsersThreeIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { PageHeader } from "~/features/app-shell";
import { EventStatusBadge, type Venue } from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { eventQueryOptions } from "../api/events.queries";
import { EventOrdersTable } from "./event-orders-table";
import { EventProfileCard } from "./event-profile-card";
import { LatestOrdersCard } from "./latest-orders-card";
import { RunOfShowCard } from "./run-of-show-card";
import { TicketTiersCard } from "./ticket-tiers-card";
import { TopBuyersCard } from "./top-buyers-card";

// The chart library loads with the card, not with the first script of the app.
const SalesPaceCard = lazy(() =>
	import("./sales-pace-card").then((module) => ({
		default: module.SalesPaceCard,
	})),
);

type EventDetailPageProps = {
	/** The `$eventId` param of the URL, for example "evt-1013". Any text: an unknown id shows not found. */
	eventId: string;
};

/** One column on a phone: the profile comes first, so the day and the venue show without a scroll. */
export function EventDetailPage({ eventId }: EventDetailPageProps) {
	const { t, locale } = useT();
	const { data } = useSuspenseQuery(eventQueryOptions(eventId));
	const number = new Intl.NumberFormat(locale);

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
			<div className="grid gap-4">
				{backLink}
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
			</div>
		);
	}
	const { event, orders, salesPace, now } = data;
	// An announced event sells no ticket yet, so it has no guest list.
	const hasGuests = event.status !== "announced";

	return (
		<div className="grid gap-4">
			{backLink}
			<PageHeader
				title={event.name}
				description={
					<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<EventStatusBadge status={event.status} />
						<span>{`${t(`events.kinds.${event.kind}`)} · ${event.venue.name}`}</span>
					</span>
				}
				actions={
					hasGuests ? (
						<Button asChild>
							<Link to="/app/attendees" search={{ event: event.id }}>
								<UsersThreeIcon />
								<span className="hidden lg:inline">
									{t("events.openGuestList")}
								</span>
							</Link>
						</Button>
					) : null
				}
			/>
			<Tabs defaultValue="overview" className="gap-4">
				<TabsList>
					<TabsTrigger value="overview">{t("events.overviewTab")}</TabsTrigger>
					<TabsTrigger value="orders">
						{`${t("events.ordersTab")} · ${number.format(orders.length)}`}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="overview">
					<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
						<div className="grid gap-4">
							<EventProfileCard event={event} now={now} />
							<TicketTiersCard tiers={event.tierSales} />
							<FacilitiesCard venue={event.venue} />
						</div>
						<div className="@4xl/main:col-span-2 grid min-w-0 gap-4">
							<Suspense fallback={<Skeleton className="h-80" />}>
								<SalesPaceCard event={event} points={salesPace} />
							</Suspense>
							<RunOfShowCard
								items={event.schedule}
								now={now}
								isCancelled={event.status === "cancelled"}
							/>
							<div className="grid @2xl/main:grid-cols-2 gap-4">
								<LatestOrdersCard orders={orders} />
								<TopBuyersCard orders={orders} />
							</div>
						</div>
					</div>
				</TabsContent>
				<TabsContent value="orders">
					<Card>
						<CardContent>
							<EventOrdersTable orders={orders} eventId={event.id} />
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

// The facilities of the venue as outline badges, as the kit "skills" card shows tags.
function FacilitiesCard({ venue }: { venue: Venue }) {
	const { t } = useT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("venues.facilitiesTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-wrap gap-2">
				{venue.facilities.map((facility) => (
					<Badge key={facility} variant="outline">
						{t(`venues.facilities.${facility}`)}
					</Badge>
				))}
			</CardContent>
		</Card>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function EventDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-8 w-32" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-72" />
				<Skeleton className="h-5 w-96 max-w-full" />
			</div>
			<Skeleton className="h-9 w-48" />
			<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
				<div className="grid gap-4">
					<Skeleton className="h-112" />
					<Skeleton className="h-56" />
				</div>
				<div className="@4xl/main:col-span-2 grid gap-4">
					<Skeleton className="h-80" />
					<Skeleton className="h-96" />
				</div>
			</div>
		</div>
	);
}
