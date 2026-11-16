// The venues page behind login: a search, a sort, and one card per venue.
// The /app/venues route renders it after its loader. The route also uses the skeleton and the error below.
// The `venue` search param of the URL opens the side panel of one venue.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { fillMessage } from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { MagnifyingGlassIcon } from "~/shared/ui/icons";
import { Input } from "~/shared/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { venuesQueryOptions } from "../api/venues.queries";
import type { VenueRow } from "../lib/venue-rows";
import { VenueCard } from "./venue-card";
import { VenueSheet } from "./venue-sheet";

/** The sort choices of the cards. Each one has the label `venues.sort.<value>`. */
const VENUE_SORTS = ["capacity", "next", "name"] as const;
type VenueSort = (typeof VENUE_SORTS)[number];

type VenuesPageProps = {
	/** The venue id of the `venue` search param, for example "v-lantern". undefined when no panel is open. */
	openVenueId: string | undefined;
};

/** The cards follow the search and the sort. A venue with nothing booked goes last in the "next" sort. */
export function VenuesPage({ openVenueId }: VenuesPageProps) {
	const { t, locale } = useT();
	const navigate = useNavigate();
	const { data: venues } = useSuspenseQuery(venuesQueryOptions());
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<VenueSort>("capacity");
	// The last open venue stays in the panel while it slides out. It is view state, not server data.
	const [shownVenueId, setShownVenueId] = useState(openVenueId);
	if (openVenueId !== undefined && openVenueId !== shownVenueId) {
		setShownVenueId(openVenueId);
	}

	const number = new Intl.NumberFormat(locale);
	const collator = new Intl.Collator(locale);
	const needle = query.trim().toLocaleLowerCase(locale);
	const matches = needle
		? venues.filter((venue) =>
				`${venue.name} ${venue.area} ${t(`venues.kinds.${venue.kind}`)}`
					.toLocaleLowerCase(locale)
					.includes(needle),
			)
		: venues;
	const nextStart = (venue: VenueRow) =>
		venue.upcoming[0]?.startsAt ?? Number.POSITIVE_INFINITY;
	const sorted = [...matches].sort((first, second) =>
		sort === "capacity"
			? second.capacity - first.capacity
			: sort === "next"
				? nextStart(first) - nextStart(second)
				: collator.compare(first.name, second.name),
	);
	const totalSeats = venues.reduce((sum, venue) => sum + venue.capacity, 0);
	const setOpenVenue = (venueId: string | undefined) =>
		navigate({ to: "/app/venues", search: { venue: venueId }, replace: true });

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("venues.title")}
				description={fillMessage(t("venues.description"), {
					venues: number.format(venues.length),
					seats: number.format(totalSeats),
				})}
			/>
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative w-full sm:max-w-xs">
					<MagnifyingGlassIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={t("venues.search")}
						aria-label={t("venues.search")}
						className="ps-8"
					/>
				</div>
				<Select
					value={sort}
					onValueChange={(value) =>
						setSort(
							VENUE_SORTS.find((option) => option === value) ?? "capacity",
						)
					}
				>
					<SelectTrigger
						className="w-full sm:w-52"
						aria-label={t("venues.sortLabel")}
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{VENUE_SORTS.map((option) => (
							<SelectItem key={option} value={option}>
								{t(`venues.sort.${option}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			{sorted.length === 0 ? (
				<Card>
					<CardContent className="py-10 text-center text-muted-foreground text-sm">
						{t("venues.noResults")}
					</CardContent>
				</Card>
			) : (
				<div className="grid @2xl/main:grid-cols-2 @6xl/main:grid-cols-3 grid-cols-1 gap-6">
					{sorted.map((venue) => (
						<VenueCard
							key={venue.id}
							venue={venue}
							onOpen={() => setOpenVenue(venue.id)}
						/>
					))}
				</div>
			)}
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

// Placeholder cards of the skeleton. Fixed keys, because the cards never reorder.
const SKELETON_CARDS = ["1", "2", "3", "4", "5", "6"];

/** Placeholder while the loader runs: the header, the toolbar, and 6 cards. */
export function VenuesPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-64" />
			</div>
			<div className="flex flex-wrap gap-2">
				<Skeleton className="h-9 w-full sm:max-w-xs" />
				<Skeleton className="h-9 w-52" />
			</div>
			<div className="grid @2xl/main:grid-cols-2 @6xl/main:grid-cols-3 gap-6">
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-72" />
				))}
			</div>
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
