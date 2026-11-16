// The programme behind login: the page header, the status tabs, the kind filter, and the searchable table.
// The /app/events route renders it after its loader. The route also uses the skeleton and the error below.
// The status tab and the kind filter narrow the rows; then DataTable searches, sorts, and pages them.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	EVENT_KINDS,
	EVENT_STATUSES,
	type EventKind,
	type EventStatus,
	EventStatusBadge,
	type EventSummary,
	fillMessage,
	formatRelativeTime,
	moneyFormat,
	SellThrough,
	VENUES,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { eventsQueryOptions } from "../api/events.queries";

/** The list page. The order of the query puts the events to come first. */
export function EventsPage() {
	const { t, locale } = useT();
	const { data: events } = useSuspenseQuery(eventsQueryOptions());
	const [status, setStatus] = useState<EventStatus | "all">("all");
	const [kind, setKind] = useState<EventKind | "all">("all");

	const now = Date.now();
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const dateTime = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
		hour: "numeric",
		minute: "2-digit",
	});
	const shortDate = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
	// A cancelled event refunds every order, so its sales are the refunded tickets.
	const soldShown = (row: EventSummary) =>
		row.status === "cancelled" ? row.sold + row.refundedTickets : row.sold;
	const ofKind =
		kind === "all" ? events : events.filter((event) => event.kind === kind);
	// A tab shows only for a status that has rows of the chosen kind.
	const tabs = EVENT_STATUSES.map((value) => ({
		value,
		count: ofKind.filter((event) => event.status === value).length,
	})).filter((tab) => tab.count > 0);
	// A kind change can empty the chosen tab. Its tab then disappears, so the list shows all rows.
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const changeStatus = (value: string) =>
		setStatus(EVENT_STATUSES.find((option) => option === value) ?? "all");
	const rows =
		activeStatus === "all"
			? ofKind
			: ofKind.filter((event) => event.status === activeStatus);

	// The status comes second, so it stays in view at 390 px.
	const columns: DataTableColumn<EventSummary>[] = [
		{
			id: "event",
			header: t("events.event"),
			sortValue: (row) => row.name,
			// justify-items-start: each line is as wide as its text, so dir="auto" text sits at the start side.
			cell: (row) => (
				<div className="grid min-w-44 justify-items-start">
					<Link
						to="/app/events/$eventId"
						params={{ eventId: row.id }}
						className="whitespace-normal font-medium hover:underline"
						dir="auto"
					>
						{row.name}
					</Link>
					{/* The kind joins the venue line, so the table fits beside the open sidebar at 1024 px. */}
					<span className="whitespace-normal text-muted-foreground text-xs">
						<bdi>{row.venue.name}</bdi>
						{` · ${t(`events.kinds.${row.kind}`)}`}
					</span>
					{/* On a narrow card the date column is out of view, so the date also shows here. */}
					<span className="@xl/main:hidden text-muted-foreground text-xs tabular-nums">
						{shortDate.format(row.startsAt)}
					</span>
				</div>
			),
		},
		{
			id: "status",
			header: t("events.status"),
			sortValue: (row) => EVENT_STATUSES.indexOf(row.status),
			cell: (row) => <EventStatusBadge status={row.status} />,
		},
		{
			id: "date",
			header: t("events.date"),
			sortValue: (row) => row.startsAt,
			cell: (row) => (
				<div className="grid whitespace-nowrap">
					<span className="tabular-nums">{dateTime.format(row.startsAt)}</span>
					<span className="text-muted-foreground text-xs">
						{formatRelativeTime(row.startsAt, now, locale)}
					</span>
				</div>
			),
		},
		{
			id: "sold",
			header: t("events.sold"),
			sortValue: (row) => soldShown(row) / row.capacity,
			// A cancelled event shows its sales before the cancellation, muted, as its detail page does.
			cell: (row) =>
				row.status === "cancelled" ? (
					<div className="grid w-28 gap-1">
						<SellThrough
							sold={soldShown(row)}
							capacity={row.capacity}
							className="opacity-60"
						/>
						<span className="text-muted-foreground text-xs">
							{t("events.refundedAmount")}
						</span>
					</div>
				) : (
					<SellThrough
						sold={row.sold}
						capacity={row.capacity}
						className="w-28"
					/>
				),
		},
		{
			id: "gross",
			header: t("events.gross"),
			align: "end",
			sortValue: (row) => row.gross,
			// The struck amount is the money paid back, so it does not count as revenue.
			cell: (row) =>
				row.status === "cancelled" ? (
					<s className="text-muted-foreground tabular-nums">
						{money.format(row.refundedGross)}
					</s>
				) : (
					money.format(row.gross)
				),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("events.title")}
				description={fillMessage(t("events.description"), {
					events: number.format(events.length),
					venues: number.format(VENUES.length),
				})}
			/>
			<Card>
				<CardContent>
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) => `${row.name} ${row.venue.name} ${row.note}`}
						noResults={t("events.noResults")}
						toolbar={
							<>
								<Select
									value={kind}
									onValueChange={(value) =>
										setKind(
											EVENT_KINDS.find((option) => option === value) ?? "all",
										)
									}
								>
									<SelectTrigger
										className="w-full sm:w-44"
										aria-label={t("events.kind")}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">{t("events.allKinds")}</SelectItem>
										{EVENT_KINDS.map((option) => (
											<SelectItem key={option} value={option}>
												{t(`events.kinds.${option}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{/* Below the 36rem container the tabs do not fit, so a Select holds the same choice. */}
								<Select value={activeStatus} onValueChange={changeStatus}>
									<SelectTrigger
										className="@xl/main:hidden w-full"
										aria-label={t("events.status")}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">
											{`${t("events.all")} · ${number.format(ofKind.length)}`}
										</SelectItem>
										{tabs.map((tab) => (
											<SelectItem key={tab.value} value={tab.value}>
												{`${t(`events.statuses.${tab.value}`)} · ${number.format(tab.count)}`}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Tabs
									value={activeStatus}
									onValueChange={changeStatus}
									className="@xl/main:flex hidden max-w-full overflow-x-auto"
								>
									<TabsList>
										<TabsTrigger value="all">
											{t("events.all")}
											<span className="text-muted-foreground tabular-nums">
												{number.format(ofKind.length)}
											</span>
										</TabsTrigger>
										{tabs.map((tab) => (
											<TabsTrigger key={tab.value} value={tab.value}>
												{t(`events.statuses.${tab.value}`)}
												<span className="text-muted-foreground tabular-nums">
													{number.format(tab.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
							</>
						}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function EventsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-64" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<div className="flex flex-wrap gap-2">
						<Skeleton className="h-9 w-full sm:max-w-xs" />
						<Skeleton className="h-9 w-44" />
						<Skeleton className="h-9 w-80" />
					</div>
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the list and the detail page when a loader fails. Try again runs the loader again. */
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
