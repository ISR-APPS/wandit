// Reads of listings: the full list, the figures of the list page, and one listing with its leads, its viewings, and its history.
// The list and detail routes prefetch them in their loaders. The pages read them with useSuspenseQuery.
// Each queryFn returns sample rows of ~/features/agency. To make it real: replace the body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	type Agent,
	DAY_MS,
	findAgent,
	type LeadRow,
	type ListingRow,
	readLeadRows,
	readListingRows,
	readViewingRows,
	type ViewingRow,
} from "~/features/agency";
import {
	buildListingFigures,
	FIGURES_COMPARE_DAYS,
} from "../lib/listing-figures";
import {
	buildListingTimeline,
	type TimelineStep,
} from "../lib/listing-timeline";

/** Everything that the detail page shows for one listing. */
export type ListingDetail = {
	listing: ListingRow;
	/** The agent who holds the listing. */
	agent: Agent;
	/** The leads that asked about this home, newest first. */
	enquiries: LeadRow[];
	/** The lead whose offer the seller accepted. null while the home has no accepted offer. */
	buyer: LeadRow | null;
	/** The viewings of this home, newest first. */
	viewings: ViewingRow[];
	/** The dated steps of the listing, newest first. */
	timeline: TimelineStep[];
};

/** Every listing, newest first. The list page filters, searches, sorts, and pages them in the browser. */
export function listingsQueryOptions() {
	return queryOptions({
		queryKey: ["listings", "list"],
		queryFn: async () => readListingRows(Date.now()),
	});
}

/** The four figures of the list page, against 30 days earlier. The sample rows of that time hold only the facts true then. */
export function listingFiguresQueryOptions() {
	return queryOptions({
		queryKey: ["listings", "figures"],
		queryFn: async () => {
			const now = Date.now();
			return buildListingFigures(
				readListingRows(now),
				readListingRows(now - FIGURES_COMPARE_DAYS * DAY_MS),
				now,
			);
		},
	});
}

/** One listing with its leads, its viewings, and its history. null when the id does not exist. */
export function listingQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["listings", "detail", id],
		queryFn: async (): Promise<ListingDetail | null> => {
			const now = Date.now();
			// The id comes from the URL. An unknown id is "not found", not an error.
			const listing = readListingRows(now).find(
				(candidate) => candidate.id === id,
			);
			if (!listing) {
				return null;
			}
			const enquiries = readLeadRows(now).filter(
				(lead) => lead.listingId === id,
			);
			const viewings = readViewingRows(now).filter(
				(viewing) => viewing.listingId === id,
			);
			return {
				listing,
				agent: findAgent(listing.agentId),
				enquiries,
				// The accepted offer is the only offer with the agreed price.
				buyer:
					listing.agreedPrice === null
						? null
						: (enquiries.find(
								(lead) => lead.offerAmount === listing.agreedPrice,
							) ?? null),
				viewings: [...viewings].reverse(),
				timeline: buildListingTimeline(listing, enquiries, viewings),
			};
		},
	});
}
