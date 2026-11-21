// Builds the history of one listing for its detail page: the dated steps from the seller's signature to the sale.
// listings.queries.ts calls it with the listing, its leads, and its viewings. It reads no clock.
import type { LeadRow, ListingRow, ViewingRow } from "~/features/agency";

/** The kinds of step. The label is the message key `listings.timeline.<kind>`. */
export type TimelineKind =
	| "instructed"
	| "launch_planned"
	| "listed"
	| "first_enquiry"
	| "first_viewing"
	| "price_reduced"
	| "offer_accepted"
	| "sold"
	| "withdrawn";

/** One dated step in the history of a listing. */
export type TimelineStep = {
	kind: TimelineKind;
	/** The time of the step, as an ISO text. In the future only for "launch_planned". */
	at: string;
	/** A price that belongs to the step, in whole units of the currency: the asking, the new, or the agreed price. */
	amount: number | null;
	/** The name of a person of the step: the seller, or the first lead. null for a step with no person. */
	person: string | null;
};

/**
 * The steps of `listing`, newest first. `enquiries` (newest first) and `viewings` (oldest first)
 * are the rows of this listing only.
 */
export function buildListingTimeline(
	listing: ListingRow,
	enquiries: LeadRow[],
	viewings: ViewingRow[],
): TimelineStep[] {
	const steps: TimelineStep[] = [
		{
			kind: "instructed",
			at: listing.instructedAt,
			amount: null,
			person: listing.sellerName,
		},
		{
			kind: listing.status === "coming_soon" ? "launch_planned" : "listed",
			at: listing.listedAt,
			amount: listing.originalPrice,
			person: null,
		},
	];
	// The enquiries are newest first, so the last one is the first that arrived.
	const firstEnquiry = enquiries.at(-1);
	if (firstEnquiry) {
		steps.push({
			kind: "first_enquiry",
			at: firstEnquiry.createdAt,
			amount: null,
			person: firstEnquiry.fullName,
		});
	}
	// The viewings are oldest first. A cancelled visit did not take place.
	const firstViewing = viewings.find(
		(viewing) => viewing.status === "completed",
	);
	if (firstViewing) {
		steps.push({
			kind: "first_viewing",
			at: firstViewing.startsAt,
			amount: null,
			person: firstViewing.leadName,
		});
	}
	if (listing.priceReducedAt !== null) {
		steps.push({
			kind: "price_reduced",
			at: listing.priceReducedAt,
			amount: listing.askingPrice,
			person: null,
		});
	}
	if (listing.offerAcceptedAt !== null) {
		steps.push({
			kind: "offer_accepted",
			at: listing.offerAcceptedAt,
			amount: listing.agreedPrice,
			person: null,
		});
	}
	if (listing.soldAt !== null) {
		steps.push({
			kind: "sold",
			at: listing.soldAt,
			amount: listing.agreedPrice,
			person: null,
		});
	}
	if (listing.withdrawnAt !== null) {
		steps.push({
			kind: "withdrawn",
			at: listing.withdrawnAt,
			amount: null,
			person: listing.sellerName,
		});
	}
	return steps.sort(
		(first, second) => Date.parse(second.at) - Date.parse(first.at),
	);
}

/** The steps of a sale in order. The sale progress card counts how many of them a listing reached. */
export const SALE_STEPS = [
	"listed",
	"first_enquiry",
	"first_viewing",
	"offer_accepted",
	"sold",
] as const satisfies readonly TimelineKind[];

/** The count of SALE_STEPS in `steps`. A listing that is not on the market yet has 0. */
export function saleStepsDone(steps: TimelineStep[]): number {
	return SALE_STEPS.filter((kind) => steps.some((step) => step.kind === kind))
		.length;
}
