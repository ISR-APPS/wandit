// The attendees page behind login: the header with the CSV export, then one table of every order of every event,
// with a filter field, the Event, Status, and Kind filters, a column menu, checkboxes, a row menu, and pages.
// The /app/attendees route renders it after its loader. `?event=` sets the event filter and `?order=` opens the order panel.
// It follows the kit "users" page through RecordTable.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	ATTENDANCE_STATUSES,
	AttendanceBadge,
	type CsvColumn,
	copyToClipboard,
	downloadCsv,
	EVENT_KINDS,
	initialsOf,
	toCsv,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { guestsQueryOptions } from "../api/attendees.queries";
import type { GuestRow } from "../lib/guest-rows";
import { GuestSheet } from "./guest-sheet";

type AttendeesPageProps = {
	/** The event id of the `event` search param, for example "evt-1025". undefined shows every event. */
	eventId: string | undefined;
	/** The order id of the `order` search param, for example "evt-1025-o0042". undefined when no panel is open. */
	openOrderId: string | undefined;
};

/** The event filter lives in the URL, so a link from an event page opens its guests. */
export function AttendeesPage({ eventId, openOrderId }: AttendeesPageProps) {
	const { t } = useT();
	const navigate = useNavigate();
	const { data: guests } = useSuspenseQuery(guestsQueryOptions());
	const [status, setStatus] = useState<string | null>(null);
	const [kind, setKind] = useState<string | null>(null);
	// The last open order stays in the panel while it slides out. It is view state, not server data.
	const [shownOrderId, setShownOrderId] = useState(openOrderId);
	if (openOrderId !== undefined && openOrderId !== shownOrderId) {
		setShownOrderId(openOrderId);
	}
	const shownGuest = guests.find((row) => row.id === shownOrderId);
	const setSearch = (next: { event?: string; order?: string }) =>
		navigate({ to: "/app/attendees", search: next, replace: true });

	// The event filter lists each event once, in the order of its latest activity.
	const eventOptions = [
		...new Map(
			guests.map((row) => [
				row.eventId,
				{ value: row.eventId, label: row.event.name },
			]),
		).values(),
	];
	// An id in the URL that has no guest falls back to every event.
	const eventFilter = eventOptions.some((option) => option.value === eventId)
		? (eventId ?? null)
		: null;
	const rows = guests.filter(
		(row) =>
			(eventFilter === null || row.eventId === eventFilter) &&
			(status === null || row.status === status) &&
			(kind === null || row.event.kind === kind),
	);

	const columns: RecordColumn<GuestRow>[] = [
		{
			id: "guest",
			header: t("attendees.guest"),
			cell: (row) => (
				<div className="flex items-center gap-3">
					<Avatar className="size-9">
						<AvatarFallback className="bg-muted text-xs">
							{initialsOf(row.buyerName)}
						</AvatarFallback>
					</Avatar>
					<button
						type="button"
						onClick={() => setSearch({ event: eventId, order: row.id })}
						className="max-w-44 truncate text-start font-medium hover:underline"
						dir="auto"
					>
						{row.buyerName}
					</button>
				</div>
			),
			sortValue: (row) => row.buyerName,
		},
		{
			id: "event",
			header: t("attendees.event"),
			cell: (row) => (
				<Link
					to="/app/events/$eventId"
					params={{ eventId: row.eventId }}
					className="block max-w-52 truncate hover:underline"
				>
					{row.event.name}
				</Link>
			),
			sortValue: (row) => row.event.name,
			hideable: true,
		},
		{
			id: "tier",
			header: t("attendees.tier"),
			cell: (row) => <bdi className="whitespace-nowrap">{row.tierName}</bdi>,
			sortValue: (row) => row.tierName,
			hideable: true,
		},
		{
			id: "email",
			header: t("attendees.email"),
			cell: (row) => (
				<span className="block max-w-56 truncate">{row.buyerEmail}</span>
			),
			sortValue: (row) => row.buyerEmail,
			hideable: true,
		},
		{
			id: "tickets",
			header: t("attendees.tickets"),
			cell: (row) => row.quantity,
			sortValue: (row) => row.quantity,
			align: "end",
			hideable: true,
		},
		{
			id: "status",
			header: t("attendees.status"),
			cell: (row) => <AttendanceBadge status={row.status} />,
			sortValue: (row) => t(`attendees.statuses.${row.status}`),
		},
	];
	const csvColumns: CsvColumn<GuestRow>[] = [
		{ header: t("attendees.ordered"), value: (row) => row.reference },
		{ header: t("attendees.guest"), value: (row) => row.buyerName },
		{ header: t("attendees.email"), value: (row) => row.buyerEmail },
		{ header: t("attendees.event"), value: (row) => row.event.name },
		{ header: t("attendees.tier"), value: (row) => row.tierName },
		{ header: t("attendees.tickets"), value: (row) => String(row.quantity) },
		{
			header: t("attendees.status"),
			value: (row) => t(`attendees.statuses.${row.status}`),
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("attendees.title")}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv("attendees.csv", toCsv(rows, csvColumns))
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(row) =>
					`${row.buyerName} ${row.buyerEmail} ${row.reference}`
				}
				searchPlaceholder={t("attendees.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("attendees.event")}
							options={eventOptions}
							value={eventFilter}
							onValueChange={(value) =>
								setSearch({ event: value ?? undefined })
							}
						/>
						<RecordFilter
							label={t("attendees.status")}
							options={ATTENDANCE_STATUSES.map((value) => ({
								value,
								label: t(`attendees.statuses.${value}`),
							}))}
							value={status}
							onValueChange={setStatus}
						/>
						<RecordFilter
							label={t("events.kind")}
							options={EVENT_KINDS.map((value) => ({
								value,
								label: t(`events.kinds.${value}`),
							}))}
							value={kind}
							onValueChange={setKind}
						/>
					</>
				}
				selectable
				bulkActions={(selected) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv("attendees-selected.csv", toCsv(selected, csvColumns))
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem
							onSelect={() => setSearch({ event: eventId, order: row.id })}
						>
							{t("table.open")}
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link to="/app/events/$eventId" params={{ eventId: row.eventId }}>
								{t("attendees.openEvent")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.buyerEmail, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("table.copyEmail")}
						</DropdownMenuItem>
					</>
				)}
				pageSize={10}
				noResults={t("attendees.noResults")}
			/>
			{shownGuest ? (
				<GuestSheet
					guest={shownGuest}
					event={shownGuest.event}
					open={openOrderId !== undefined}
					onClose={() => setSearch({ event: eventId })}
				/>
			) : null}
		</div>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function AttendeesPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-full max-w-2xl" />
			<Skeleton className="h-144" />
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
