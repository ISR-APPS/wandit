// The venues page behind login: the header with the CSV export, four KPI cards, then one table of the venues
// with a filter field, the Kind and Booking filters, a column menu, checkboxes, a row menu, and pages.
// The /app/venues route renders it after its loader. The `venue` search param opens the side panel of one venue.
// It follows the kit "products" page: small KPI cards with a delta badge, then the product table.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type CsvColumn,
	copyToClipboard,
	downloadCsv,
	initialsOf,
	moneyFormat,
	toCsv,
	VENUE_KINDS,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
} from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	venueKpisQueryOptions,
	venuesQueryOptions,
} from "../api/venues.queries";
import type { VenueKpi, VenueRow } from "../lib/venue-rows";
import { VenueSheet } from "./venue-sheet";

/** The booking state of a venue: with an event in the next 14 days, or with nothing booked in that window. */
type BookingState = "booked" | "free";

function bookingOf(venue: VenueRow): BookingState {
	return venue.isBookedSoon ? "booked" : "free";
}

type VenuesPageProps = {
	/** The venue id of the `venue` search param, for example "v-lantern". undefined when no panel is open. */
	openVenueId: string | undefined;
};

/** The table lists every venue. The panel keeps the last venue while it slides out. */
export function VenuesPage({ openVenueId }: VenuesPageProps) {
	const { t, locale } = useT();
	const navigate = useNavigate();
	const { data: venues } = useSuspenseQuery(venuesQueryOptions());
	const { data: kpis } = useSuspenseQuery(venueKpisQueryOptions());
	const [kind, setKind] = useState<string | null>(null);
	const [booking, setBooking] = useState<string | null>(null);
	// The last open venue stays in the panel while it slides out. It is view state, not server data.
	const [shownVenueId, setShownVenueId] = useState(openVenueId);
	if (openVenueId !== undefined && openVenueId !== shownVenueId) {
		setShownVenueId(openVenueId);
	}
	const setOpenVenue = (venueId: string | undefined) =>
		navigate({ to: "/app/venues", search: { venue: venueId }, replace: true });

	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const rows = venues.filter(
		(venue) =>
			(kind === null || venue.kind === kind) &&
			(booking === null || bookingOf(venue) === booking),
	);
	const formatKpi = (kpi: VenueKpi) =>
		kpi.id === "fill"
			? percent.format(kpi.value)
			: kpi.id === "hireFees"
				? money.format(kpi.value)
				: number.format(kpi.value);

	const columns: RecordColumn<VenueRow>[] = [
		{
			id: "venue",
			header: t("venues.venue"),
			cell: (row) => (
				<button
					type="button"
					onClick={() => setOpenVenue(row.id)}
					className="flex items-center gap-3 text-start hover:underline"
				>
					<span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted font-medium text-xs">
						{initialsOf(row.name)}
					</span>
					{/* No truncate: the table cell keeps one line, and on a phone the table scrolls sideways. */}
					<span className="grid gap-0.5">
						<span className="font-medium">{row.name}</span>
						<span className="text-muted-foreground text-xs">{row.area}</span>
					</span>
				</button>
			),
			sortValue: (row) => row.name,
		},
		{
			id: "fee",
			header: t("venues.hireFee"),
			cell: (row) => money.format(row.hireFeePerDay),
			sortValue: (row) => row.hireFeePerDay,
			hideable: true,
		},
		{
			id: "kind",
			header: t("venues.kind"),
			cell: (row) => t(`venues.kinds.${row.kind}`),
			sortValue: (row) => t(`venues.kinds.${row.kind}`),
			hideable: true,
		},
		{
			id: "capacity",
			header: t("venues.capacity"),
			cell: (row) => number.format(row.capacity),
			sortValue: (row) => row.capacity,
			align: "end",
		},
		{
			id: "upcoming",
			header: t("venues.comingUp"),
			cell: (row) => number.format(row.upcoming.length),
			sortValue: (row) => row.upcoming.length,
			align: "end",
			hideable: true,
		},
		{
			id: "fill",
			header: t("venues.averageFill"),
			cell: (row) =>
				row.averageFill === null ? "–" : percent.format(row.averageFill),
			sortValue: (row) => row.averageFill ?? -1,
			align: "end",
			hideable: true,
		},
		{
			id: "booking",
			header: t("venues.booking"),
			cell: (row) =>
				bookingOf(row) === "booked" ? (
					<Badge variant="success">{t("venues.bookingStates.booked")}</Badge>
				) : (
					<Badge variant="warning">{t("venues.bookingStates.free")}</Badge>
				),
			sortValue: (row) => bookingOf(row),
		},
	];
	const csvColumns: CsvColumn<VenueRow>[] = [
		{ header: t("venues.venue"), value: (row) => row.name },
		{ header: t("venues.area"), value: (row) => row.area },
		{ header: t("venues.kind"), value: (row) => t(`venues.kinds.${row.kind}`) },
		{ header: t("venues.capacity"), value: (row) => String(row.capacity) },
		{ header: t("venues.hireFee"), value: (row) => String(row.hireFeePerDay) },
		{
			header: t("venues.comingUp"),
			value: (row) => String(row.upcoming.length),
		},
		{ header: t("venues.contact"), value: (row) => row.contactEmail },
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("venues.title")}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() => downloadCsv("venues.csv", toCsv(rows, csvColumns))}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{kpis.map((kpi) => (
					<Card key={kpi.id}>
						<CardHeader>
							<CardDescription>{t(`venues.kpis.${kpi.id}`)}</CardDescription>
							<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
								{formatKpi(kpi)}
							</p>
							{kpi.change === null ? null : (
								<CardAction>
									<DeltaBadge change={kpi.change} />
								</CardAction>
							)}
						</CardHeader>
					</Card>
				))}
			</div>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(row) =>
					`${row.name} ${row.area} ${t(`venues.kinds.${row.kind}`)}`
				}
				searchPlaceholder={t("venues.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("venues.kind")}
							options={VENUE_KINDS.map((value) => ({
								value,
								label: t(`venues.kinds.${value}`),
							}))}
							value={kind}
							onValueChange={setKind}
						/>
						<RecordFilter
							label={t("venues.booking")}
							options={(["booked", "free"] as const).map((value) => ({
								value,
								label: t(`venues.bookingStates.${value}`),
							}))}
							value={booking}
							onValueChange={setBooking}
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
							downloadCsv("venues-selected.csv", toCsv(selected, csvColumns))
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem onSelect={() => setOpenVenue(row.id)}>
							{t("table.open")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.contactEmail, {
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
				noResults={t("venues.noResults")}
			/>
			<VenueSheet
				venue={venues.find((venue) => venue.id === shownVenueId)}
				open={
					openVenueId !== undefined &&
					venues.some((venue) => venue.id === openVenueId)
				}
				onClose={() => setOpenVenue(undefined)}
			/>
		</div>
	);
}

// One decimal shows 0.05 % and more. A smaller change reads "No change", never "0%".
const FLAT_CHANGE = 0.0005;

// The signed change of a KPI as a small badge, as in the kit product cards. A rise is good news for every venue KPI.
function DeltaBadge({ change }: { change: number }) {
	const { t, locale } = useT();
	if (Math.abs(change) < FLAT_CHANGE) {
		return <Badge variant="outline">{t("kpi.noChange")}</Badge>;
	}
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const text = <bdi dir="ltr">{percent.format(change)}</bdi>;
	return change > 0 ? (
		<Badge variant="success">{text}</Badge>
	) : (
		<Badge
			variant="outline"
			className="border-destructive/25 bg-destructive/12 text-destructive"
		>
			{text}
		</Badge>
	);
}

// Placeholder keys of the KPI row. Fixed keys, because the cards never reorder.
const SKELETON_KPIS = ["1", "2", "3", "4"];

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function VenuesPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-9 w-32" />
			</div>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_KPIS.map((key) => (
					<Skeleton key={key} className="h-28" />
				))}
			</div>
			<Skeleton className="h-9 w-full max-w-2xl" />
			<Skeleton className="h-112" />
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function VenuesPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("venues.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
