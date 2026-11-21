// The upcoming events card of the home: the events that have not ended, in a table with a filter field,
// a status filter, sortable heads, a column menu, a row menu, and pages. OverviewPage renders it beside the calendar.
// It follows the kit "booking list" card and section 2.4 of the kit system, through RecordTable.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	copyToClipboard,
	type EventStatus,
	EventStatusBadge,
	type EventSummary,
	moneyFormat,
	SellThrough,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";

// The statuses of an event that has not ended. A cancelled event is out of this table.
const AHEAD_STATUSES = [
	"live",
	"on_sale",
	"sold_out",
	"announced",
] as const satisfies EventStatus[];

type UpcomingEventsCardProps = {
	/** Every event of the programme, from eventsQueryOptions. The card keeps the ones ahead. */
	events: EventSummary[];
	/** The time of the page render, in milliseconds since 1970. */
	now: number;
};

/** 6 rows per page keep the card level with the calendar beside it. */
export function UpcomingEventsCard({ events, now }: UpcomingEventsCardProps) {
	const { t, locale } = useT();
	const [status, setStatus] = useState<string | null>(null);
	const money = moneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const ahead = events.filter(
		(event) => event.endsAt > now && event.status !== "cancelled",
	);
	const rows =
		status === null ? ahead : ahead.filter((event) => event.status === status);

	const columns: RecordColumn<EventSummary>[] = [
		{
			id: "event",
			header: t("events.event"),
			cell: (row) => (
				<Link
					to="/app/events/$eventId"
					params={{ eventId: row.id }}
					className="grid max-w-56 gap-0.5 hover:underline"
				>
					<span className="truncate font-medium">{row.name}</span>
					<span className="truncate text-muted-foreground text-xs">
						{row.venue.name}
					</span>
				</Link>
			),
			sortValue: (row) => row.name,
		},
		{
			id: "date",
			header: t("events.date"),
			cell: (row) => (
				<span className="grid gap-0.5 whitespace-nowrap tabular-nums">
					<span>{date.format(row.startsAt)}</span>
					<span className="text-muted-foreground text-xs">
						{time.format(row.startsAt)}
					</span>
				</span>
			),
			sortValue: (row) => row.startsAt,
			hideable: true,
		},
		{
			id: "kind",
			header: t("events.kind"),
			cell: (row) => (
				<Badge variant="outline">{t(`events.kinds.${row.kind}`)}</Badge>
			),
			sortValue: (row) => t(`events.kinds.${row.kind}`),
			hideable: true,
		},
		{
			id: "sold",
			header: t("events.sold"),
			cell: (row) => <SellThrough sold={row.sold} capacity={row.capacity} />,
			sortValue: (row) => row.sold / row.capacity,
			hideable: true,
		},
		{
			id: "gross",
			header: t("events.gross"),
			cell: (row) => money.format(row.gross),
			sortValue: (row) => row.gross,
			align: "end",
			hideable: true,
		},
		{
			id: "status",
			header: t("events.status"),
			cell: (row) => <EventStatusBadge status={row.status} />,
			sortValue: (row) => t(`events.statuses.${row.status}`),
		},
	];

	return (
		<Card className="@4xl/main:col-span-2 min-w-0">
			<CardHeader>
				<CardTitle>{t("overview.upcomingEvents")}</CardTitle>
			</CardHeader>
			<CardContent>
				<RecordTable
					rows={rows}
					columns={columns}
					searchText={(row) => `${row.name} ${row.venue.name}`}
					searchPlaceholder={t("overview.searchEvents")}
					toolbar={
						<RecordFilter
							label={t("events.status")}
							options={AHEAD_STATUSES.map((value) => ({
								value,
								label: t(`events.statuses.${value}`),
							}))}
							value={status}
							onValueChange={setStatus}
						/>
					}
					rowMenu={(row) => (
						<>
							<DropdownMenuItem asChild>
								<Link to="/app/events/$eventId" params={{ eventId: row.id }}>
									{t("table.open")}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link to="/app/attendees" search={{ event: row.id }}>
									{t("events.openGuestList")}
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
								{t("table.copyId")}
							</DropdownMenuItem>
						</>
					)}
					pageSize={6}
					noResults={t("events.noResults")}
				/>
			</CardContent>
		</Card>
	);
}
