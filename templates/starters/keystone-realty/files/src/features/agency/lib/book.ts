// The rows that the pages read: each listing, lead, and viewing joined to the names that a table shows.
// The query files of the listings, leads, viewings, and overview features call the three read functions.
// To make it real: each read function becomes one Supabase select with its joins, or one view.
import { HOUR_MS } from "./agency-clock";
import { findAgent } from "./sample-agents";
import { ANSWER_TARGET_HOURS, type Lead, listLeads } from "./sample-leads";
import {
	daysOnMarketOf,
	type Listing,
	listListings,
	type PropertyType,
} from "./sample-listings";
import { listViewings, type Viewing } from "./sample-viewings";

/** One listing with the counts that the list shows. */
export type ListingRow = Listing & {
	agentName: string;
	/** Count of the leads that asked about this home. */
	enquiryCount: number;
	/** Count of the viewings of this home that are not cancelled. A lead can visit two times. */
	viewingCount: number;
	/** Count of the different leads with a viewing of this home that is not cancelled. Never above enquiryCount. */
	viewerCount: number;
	/** Count of the leads that made an offer on this home. */
	offerCount: number;
	/** Whole days on the market, until today or until the home left the market. */
	daysOnMarket: number;
};

/** One lead with the names that the list shows. */
export type LeadRow = Lead & {
	agentName: string;
	/** The street line of the home that a buyer asks about, for example "214 Alder Street". null with no home. */
	listingStreet: string | null;
	/** The kind of that home, for its tile. null with no home. */
	listingType: PropertyType | null;
	/** The asking price of that home, in whole units of the currency. null with no home. */
	listingPrice: number | null;
	/** Minutes from the arrival to the first answer. null while the lead is "new". */
	answerMinutes: number | null;
	/** True for a "new" lead that waits longer than the answer target of the agency. */
	isLate: boolean;
};

/** One viewing with the names that the agenda shows. */
export type ViewingRow = Viewing & {
	agentName: string;
	leadName: string;
	/** The street line of the home, for example "214 Alder Street". */
	listingStreet: string;
	/** The unit in the building, or null for a house. */
	listingUnit: string | null;
	/** The kind of the home, for its tile. */
	listingType: PropertyType;
	neighborhood: string;
};

/** Every listing, newest first. The "coming soon" homes come first: their first market day is in the future. */
export function readListingRows(now: number): ListingRow[] {
	const leads = listLeads(now);
	const viewings = listViewings(now);
	return listListings(now)
		.map((listing) => {
			const enquiries = leads.filter((lead) => lead.listingId === listing.id);
			const booked = viewings.filter(
				(viewing) =>
					viewing.listingId === listing.id && viewing.status !== "cancelled",
			);
			return {
				...listing,
				agentName: findAgent(listing.agentId).fullName,
				enquiryCount: enquiries.length,
				viewingCount: booked.length,
				viewerCount: new Set(booked.map((viewing) => viewing.leadId)).size,
				offerCount: enquiries.filter((lead) => lead.offerAt !== null).length,
				daysOnMarket: daysOnMarketOf(listing, now),
			};
		})
		.reverse();
}

/** Every lead, newest first. */
export function readLeadRows(now: number): LeadRow[] {
	const listings = listListings(now);
	return listLeads(now).map((lead) => {
		const listing = listings.find(
			(candidate) => candidate.id === lead.listingId,
		);
		const createdAt = Date.parse(lead.createdAt);
		return {
			...lead,
			agentName: findAgent(lead.agentId).fullName,
			listingStreet: listing?.street ?? null,
			listingType: listing?.type ?? null,
			listingPrice: listing?.askingPrice ?? null,
			answerMinutes:
				lead.firstResponseAt === null
					? null
					: Math.round((Date.parse(lead.firstResponseAt) - createdAt) / 60_000),
			isLate:
				lead.status === "new" &&
				now - createdAt > ANSWER_TARGET_HOURS * HOUR_MS,
		};
	});
}

/** Every viewing, by start time, oldest first. */
export function readViewingRows(now: number): ViewingRow[] {
	const listings = listListings(now);
	const leads = listLeads(now);
	return listViewings(now).flatMap((viewing) => {
		const listing = listings.find(
			(candidate) => candidate.id === viewing.listingId,
		);
		const lead = leads.find((candidate) => candidate.id === viewing.leadId);
		// Every viewing has its home and its lead in the sample data. A row with no match is left out.
		if (!listing || !lead) {
			return [];
		}
		return [
			{
				...viewing,
				agentName: findAgent(viewing.agentId).fullName,
				leadName: lead.fullName,
				listingStreet: listing.street,
				listingUnit: listing.unit,
				listingType: listing.type,
				neighborhood: listing.neighborhood,
			},
		];
	});
}
