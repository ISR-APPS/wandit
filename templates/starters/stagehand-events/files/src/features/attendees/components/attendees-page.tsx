// The guest list behind login: the event picker, the four figures of the event, and the table of its orders.
// The /app/attendees route renders it after its loader. The route also uses the skeleton and the error below.
// `?event=` picks the event and `?order=` opens the side panel of one order.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	ATTENDANCE_STATUSES,
	AttendanceBadge,
	type AttendanceStatus,
	countLabel,
	formatRelativeTime,
	initialsOf,
	moneyFormat,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
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
import {
	guestListEventsQueryOptions,
	guestListQueryOptions,
} from "../api/attendees.queries";
import type { GuestRow } from "../lib/guest-rows";
import { GuestListSummary } from "./guest-list-summary";
import { GuestSheet } from "./guest-sheet";

type AttendeesPageProps = {
	/** The event of the list, already resolved by the route: the `event` param or the default event. */
	eventId: string | undefined;
	/** The order id of the `order` search param, for example "evt-1025-o0042". undefined when no panel is open. */
	openOrderId: string | undefined;
};

/** The list page. The status tab filters the rows; then DataTable searches, sorts, and pages them. */
export function AttendeesPage({ eventId, openOrderId }: AttendeesPageProps) {
	const { t, locale } = useT();
	const navigate = useNavigate();
	const { data: events } = useSuspenseQuery(guestListEventsQueryOptions());
	const dayMonth = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("attendees.title")}
				description={t("attendees.description")}
				actions={
					eventId ? (
						<Select
							value={eventId}
							onValueChange={(value) =>
								navigate({ to: "/app/attendees", search: { event: value } })
							}
						>
							<SelectTrigger
								className="w-full sm:w-80"
								aria-label={t("attendees.event")}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{events.map((event) => (
									<SelectItem key={event.id} value={event.id}>
										{/* One text, because the trigger copies the item text and drops the gap between spans. */}
										<span className="truncate">
											{dayMonth.format(event.startsAt)}
											{" · "}
											<bdi>{event.name}</bdi>
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : null
				}
			/>
			{eventId ? (
				// A new key resets the status tab when the event changes.
				<GuestList key={eventId} eventId={eventId} openOrderId={openOrderId} />
			) : (
				<Card>
					<CardContent className="py-10 text-center text-muted-foreground text-sm">
						{t("attendees.noEvents")}
					</CardContent>
				</Card>
			)}
		</div>
	);
}

type GuestListProps = {
	/** The id of an event of the picker. */
	eventId: string;
	/** The order of the open side panel, or undefined. */
	openOrderId: string | undefined;
};

// The summary, the tabs, the table, and the panel of one event.
function GuestList({ eventId, openOrderId }: GuestListProps) {
	const { t, locale } = useT();
	const navigate = useNavigate();
	const { data } = useSuspenseQuery(guestListQueryOptions(eventId));
	const [status, setStatus] = useState<AttendanceStatus | "all">("all");
	// The last open order stays in the panel while it slides out. It is view state, not server data.
	const [shownOrderId, setShownOrderId] = useState(openOrderId);
	if (openOrderId !== undefined && openOrderId !== shownOrderId) {
		setShownOrderId(openOrderId);
	}
	if (!data) {
		return null;
	}
	const { event, rows, now } = data;
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	// A tab shows only for a status that has rows.
	const tabs = ATTENDANCE_STATUSES.map((value) => ({
		value,
		count: rows.filter((row) => row.status === value).length,
	})).filter((tab) => tab.count > 0);
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const changeStatus = (value: string) =>
		setStatus(ATTENDANCE_STATUSES.find((option) => option === value) ?? "all");
	const shownRows =
		activeStatus === "all"
			? rows
			: rows.filter((row) => row.status === activeStatus);
	const openOrder = (orderId: string | undefined) =>
		navigate({
			to: "/app/attendees",
			search: { event: eventId, order: orderId },
			replace: true,
		});

	// The door status comes second: it is the point of a guest list, and it stays in view at 390 px.
	const columns: DataTableColumn<GuestRow>[] = [
		{
			id: "guest",
			header: t("attendees.guest"),
			sortValue: (row) => row.buyerName,
			cell: (row) => (
				<div className="flex min-w-44 items-center gap-3">
					<Avatar className="size-8">
						<AvatarFallback className="text-xs">
							{initialsOf(row.buyerName)}
						</AvatarFallback>
					</Avatar>
					{/* Below the 64rem container the email truncates, so the table fits beside the open sidebar. */}
					<div className="grid min-w-0 @5xl/main:max-w-none max-w-32 justify-items-start">
						<button
							type="button"
							onClick={() => openOrder(row.id)}
							className="max-w-full truncate text-start font-medium hover:underline"
							dir="auto"
						>
							{row.buyerName}
						</button>
						<span className="max-w-full truncate text-muted-foreground text-xs">
							{row.buyerEmail}
						</span>
					</div>
				</div>
			),
		},
		{
			id: "status",
			header: t("attendees.status"),
			sortValue: (row) => ATTENDANCE_STATUSES.indexOf(row.status),
			cell: (row) => <AttendanceBadge status={row.status} />,
		},
		{
			id: "tier",
			header: t("attendees.tier"),
			sortValue: (row) => row.tierName,
			cell: (row) => <bdi className="whitespace-nowrap">{row.tierName}</bdi>,
		},
		{
			id: "ordered",
			header: t("attendees.ordered"),
			sortValue: (row) => row.placedAt,
			cell: (row) => (
				<div className="grid whitespace-nowrap">
					<span className="tabular-nums">{row.reference}</span>
					<span className="text-muted-foreground text-xs">
						{countLabel(
							row.quantity,
							t("attendees.ticketOne"),
							t("attendees.ticketOther"),
							locale,
						)}
						{" · "}
						{formatRelativeTime(row.placedAt, now, locale)}
					</span>
				</div>
			),
		},
		{
			id: "amount",
			header: t("attendees.amount"),
			align: "end",
			sortValue: (row) => row.amount,
			cell: (row) => money.format(row.amount),
		},
	];

	return (
		<>
			<GuestListSummary event={event} rows={rows} now={now} />
			<Card>
				<CardContent>
					<DataTable
						rows={shownRows}
						columns={columns}
						searchText={(row) =>
							`${row.buyerName} ${row.buyerEmail} ${row.reference}`
						}
						noResults={t("attendees.noResults")}
						toolbar={
							<>
								{/* Below the 36rem container the tabs do not fit, so a Select holds the same choice. */}
								<Select value={activeStatus} onValueChange={changeStatus}>
									<SelectTrigger
										className="@xl/main:hidden w-full"
										aria-label={t("attendees.status")}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">
											{`${t("attendees.all")} · ${number.format(rows.length)}`}
										</SelectItem>
										{tabs.map((tab) => (
											<SelectItem key={tab.value} value={tab.value}>
												{`${t(`attendees.statuses.${tab.value}`)} · ${number.format(tab.count)}`}
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
											{t("attendees.all")}
											<span className="text-muted-foreground tabular-nums">
												{number.format(rows.length)}
											</span>
										</TabsTrigger>
										{tabs.map((tab) => (
											<TabsTrigger key={tab.value} value={tab.value}>
												{t(`attendees.statuses.${tab.value}`)}
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
			<GuestSheet
				guest={rows.find((row) => row.id === shownOrderId)}
				event={event}
				open={
					openOrderId !== undefined &&
					rows.some((row) => row.id === openOrderId)
				}
				onClose={() => openOrder(undefined)}
			/>
		</>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the loader runs: the header, the figures, and the table. */
export function AttendeesPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-72" />
				</div>
				<Skeleton className="h-9 w-80" />
			</div>
			<Skeleton className="h-44 w-full" />
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-xs" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function AttendeesPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("attendees.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
