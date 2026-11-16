// The list under the facts row: the events that have not ended, the soonest first.
// OverviewPage renders it with nextEventsQueryOptions. Each row opens the event page. "See all" opens the programme.
// A live event shows its door count in place of the start time. On a phone the name wraps and is never cut.
import { Link } from "@tanstack/react-router";
import {
	EventStatusBadge,
	type EventSummary,
	fillMessage,
	formatRelativeTime,
	SellThrough,
	timeFormat,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";

type NextEventsListProps = {
	/** At most NEXT_EVENTS_COUNT events, the soonest first. */
	events: EventSummary[];
	/** The time of the load, in milliseconds since 1970. */
	now: number;
};

/** One row per event: the date tile, the name and the place, the sales bar, and the status. */
export function NextEventsList({ events, now }: NextEventsListProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const time = timeFormat(locale);
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const dayOfMonth = new Intl.DateTimeFormat(locale, { day: "numeric" });
	const month = new Intl.DateTimeFormat(locale, { month: "short" });

	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle>{t("overview.nextEvents")}</CardTitle>
				<CardDescription>{t("overview.nextEventsHint")}</CardDescription>
				<CardAction>
					<Button asChild variant="ghost" size="sm">
						<Link to="/app/events">
							{t("overview.seeAll")}
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="px-3">
				{events.length === 0 ? (
					<p className="px-3 py-8 text-center text-muted-foreground text-sm">
						{t("overview.noNextEvents")}
					</p>
				) : (
					<ul className="grid">
						{events.map((event) => {
							const startsAt = new Date(event.startsAt);
							return (
								<li key={event.id}>
									<Link
										to="/app/events/$eventId"
										params={{ eventId: event.id }}
										className="grid @3xl/main:grid-cols-[auto_minmax(0,1fr)_13rem_7rem] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 rounded-control px-3 py-3 transition-colors hover:bg-muted/60"
									>
										<div className="@3xl/main:row-span-1 row-span-2 grid w-14 justify-items-center self-start rounded-control border bg-muted/40 py-1.5 leading-tight">
											<span className="text-muted-foreground text-xs">
												{weekday.format(startsAt)}
											</span>
											<span className="font-numeric text-2xl tabular-nums">
												{dayOfMonth.format(startsAt)}
											</span>
											<span className="text-muted-foreground text-xs">
												{month.format(startsAt)}
											</span>
										</div>
										<div className="grid min-w-0 justify-items-start gap-0.5">
											<span
												className="max-w-full @3xl/main:truncate font-medium"
												dir="auto"
											>
												{event.name}
											</span>
											<span className="max-w-full @3xl/main:truncate text-muted-foreground text-sm">
												<bdi>{event.venue.name}</bdi>
												{" · "}
												{event.status === "live"
													? fillMessage(t("overview.checkedInNow"), {
															count: number.format(event.checkedIn),
														})
													: `${time.format(startsAt)} · ${formatRelativeTime(event.startsAt, now, locale)}`}
											</span>
										</div>
										{/* Below 48rem the sales bar and the badge sit under the name, so the name keeps the full width. */}
										<SellThrough
											sold={event.sold}
											capacity={event.capacity}
											className="@3xl/main:col-start-auto col-start-2"
										/>
										<div className="@3xl/main:col-start-auto col-start-2 flex @3xl/main:justify-end">
											<EventStatusBadge status={event.status} />
										</div>
									</Link>
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5"];

/** The list while the loader runs: the header and 5 rows at their final height. */
export function NextEventsListSkeleton() {
	return (
		<Card className="gap-4">
			<CardHeader>
				<Skeleton className="h-5 w-32" />
				<Skeleton className="h-4 w-56" />
			</CardHeader>
			<CardContent className="grid gap-2">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-16 w-full" />
				))}
			</CardContent>
		</Card>
	);
}
