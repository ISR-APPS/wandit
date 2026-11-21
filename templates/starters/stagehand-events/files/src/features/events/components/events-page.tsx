// The events list behind login: the page header with the CSV export, the time tabs, and a grid of event cards.
// The /app/events route renders it after its loader. The route also uses the skeleton and the error below.
// It follows the kit "project list" page: a title with a muted line and one action, then cards in 4 columns.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type CsvColumn,
	downloadCsv,
	fillMessage,
	toCsv,
	toIsoDay,
	VENUES,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { type EventListRow, eventsQueryOptions } from "../api/events.queries";
import { EventCard } from "./event-card";

/** The time tabs of the list. "ahead" holds the live events too. */
const TIME_TABS = ["ahead", "past", "cancelled"] as const;
type TimeTab = (typeof TIME_TABS)[number];

function tabOf(event: EventListRow, now: number): TimeTab {
	if (event.status === "cancelled") {
		return "cancelled";
	}
	return event.endsAt > now ? "ahead" : "past";
}

/** The list page. The query order puts the soonest events first and the newest past events first. */
export function EventsPage() {
	const { t, locale } = useT();
	const { data: events } = useSuspenseQuery(eventsQueryOptions());
	const [tab, setTab] = useState<TimeTab>("ahead");
	const now = Date.now();
	const number = new Intl.NumberFormat(locale);
	const rows = events.filter((event) => tabOf(event, now) === tab);
	const csvColumns: CsvColumn<EventListRow>[] = [
		{ header: t("events.event"), value: (row) => row.name },
		{ header: t("events.kind"), value: (row) => t(`events.kinds.${row.kind}`) },
		{ header: t("events.date"), value: (row) => toIsoDay(row.startsAt) },
		{ header: t("events.venue"), value: (row) => row.venue.name },
		{ header: t("events.sold"), value: (row) => String(row.sold) },
		{ header: t("events.capacity"), value: (row) => String(row.capacity) },
		{ header: t("events.gross"), value: (row) => String(row.gross) },
		{
			header: t("events.status"),
			value: (row) => t(`events.statuses.${row.status}`),
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("events.title")}
				description={fillMessage(t("events.description"), {
					events: number.format(events.length),
					venues: number.format(VENUES.length),
				})}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv(`events-${tab}.csv`, toCsv(rows, csvColumns))
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			<Tabs
				value={tab}
				onValueChange={(value) =>
					setTab(TIME_TABS.find((option) => option === value) ?? "ahead")
				}
			>
				<TabsList>
					{TIME_TABS.map((value) => (
						<TabsTrigger key={value} value={value}>
							{`${t(`events.tabs.${value}`)} · ${number.format(
								events.filter((event) => tabOf(event, now) === value).length,
							)}`}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			{rows.length === 0 ? (
				<p className="rounded-surface border p-6 text-muted-foreground text-sm">
					{t("events.noResults")}
				</p>
			) : (
				<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
					{rows.map((event) => (
						<EventCard key={event.id} event={event} now={now} />
					))}
				</div>
			)}
		</div>
	);
}

// Placeholder keys of the card grid. Fixed keys, because the placeholders never reorder.
const SKELETON_CARDS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function EventsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-72 max-w-full" />
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-64" />
				))}
			</div>
		</div>
	);
}

/** Error state of the list and detail pages. Try again runs the loader again. */
export function EventsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("events.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
