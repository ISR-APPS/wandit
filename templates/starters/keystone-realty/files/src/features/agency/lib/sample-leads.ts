// The sample leads of the agency: the people who ask about a home, or who want to sell one.
// book.ts reads them. The status of a lead follows the clock: an answer, a viewing, an offer, a sale.
// A lead of today exists only after its arrival time, so no row has a time in the future.
// To make it real: this module becomes the table `leads`.
import { dayNumberOf } from "./agency-clock";
import { type LeadPlan, listLeadPlans } from "./sample-lead-plans";
import type { PropertyType } from "./sample-listings";

/** Every status of a lead, in the order of the work. The label is the message key `agency.leadStatuses.<status>`. */
export const LEAD_STATUSES = [
	"new",
	"contacted",
	"viewing",
	"offer",
	"won",
	"lost",
] as const;

/** One status of a lead. "new" means that no agent answered yet. */
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Where a lead comes from. The label is the message key `agency.leadSources.<source>`. */
export const LEAD_SOURCES = [
	"portal",
	"website",
	"referral",
	"signboard",
	"social",
	"walk_in",
] as const;

/** One origin of a lead. */
export type LeadSource = (typeof LEAD_SOURCES)[number];

/** What a lead wants: to buy a listed home, or to sell a home through the agency. */
export type LeadInterest = "buy" | "sell";

/** Why the agency closed a lead with no sale. The label is the message key `agency.lostReasons.<reason>`. */
export type LostReason =
	| "no_reply"
	| "bought_elsewhere"
	| "budget"
	| "not_a_fit"
	| "changed_plans"
	| "property_gone"
	| "offer_declined"
	| "other_agency";

/** How a buyer pays. The label is the message key `agency.financing.<kind>`. */
export type Financing = "cash" | "pre_approved" | "mortgage_needed";

/** The agency answers every lead in 4 hours. A lead that waits longer is late. */
export const ANSWER_TARGET_HOURS = 4;

/** One lead, as the pages read it. The times are ISO texts. */
export type Lead = {
	/** Stable id, for example "L-47703". Also the `lead` search param of the leads page. */
	id: string;
	fullName: string;
	email: string;
	phone: string;
	interest: LeadInterest;
	source: LeadSource;
	status: LeadStatus;
	/** The id of the home that a buyer asks about. null for a seller, and for a buyer with no home in mind. */
	listingId: string | null;
	/** The district of that home, of the search of a buyer, or of the home that a seller wants to sell. */
	area: string;
	/** The kind of home that a seller wants to sell. null for a buyer. */
	sellType: PropertyType | null;
	/** The first message of the lead. */
	message: string;
	/** The most that a buyer can pay, in whole units of the currency. null for a seller. */
	budget: number | null;
	financing: Financing | null;
	/** The id of the agent who owns the lead. */
	agentId: string;
	createdAt: string;
	/** The time of the first answer of an agent. null while the lead is "new". */
	firstResponseAt: string | null;
	/** The time of the offer of a buyer, or null. */
	offerAt: string | null;
	/** The amount of that offer, in whole units of the currency. */
	offerAmount: number | null;
	/** The time the lead was won or lost, or null while it is open. */
	closedAt: string | null;
	lostReason: LostReason | null;
};

function isoOrNull(ms: number | null): string | null {
	return ms === null ? null : new Date(ms).toISOString();
}

/** A lead plan at the time `now`: only the facts that are true at that time. */
function leadAt(plan: LeadPlan, now: number): Lead {
	const isAnswered = plan.respondedAt <= now;
	const isWon = plan.wonAt !== null && plan.wonAt <= now;
	const isLost = plan.lostAt !== null && plan.lostAt <= now;
	const hasOffer = plan.offerAt !== null && plan.offerAt <= now;
	const booked = plan.viewings.filter((viewing) => viewing.bookedAt <= now);
	const lastBooked = booked.at(-1);
	// A missed or cancelled visit sends the lead back to "contacted": the agent must book again.
	const isInViewing =
		lastBooked !== undefined &&
		(lastBooked.startsAt > now || lastBooked.outcome === "completed");
	const status: LeadStatus = !isAnswered
		? "new"
		: isWon
			? "won"
			: isLost
				? "lost"
				: hasOffer
					? "offer"
					: isInViewing
						? "viewing"
						: "contacted";
	return {
		id: plan.id,
		fullName: plan.fullName,
		email: plan.email,
		phone: plan.phone,
		interest: plan.interest,
		source: plan.source,
		status,
		listingId: plan.listing?.id ?? null,
		area: plan.area,
		sellType: plan.sellType,
		message: plan.message,
		budget: plan.budget,
		financing: plan.financing,
		agentId: plan.agentId,
		createdAt: new Date(plan.createdAt).toISOString(),
		firstResponseAt: isAnswered ? isoOrNull(plan.respondedAt) : null,
		offerAt: hasOffer ? isoOrNull(plan.offerAt) : null,
		offerAmount: hasOffer ? plan.offerAmount : null,
		closedAt: isWon
			? isoOrNull(plan.wonAt)
			: isLost
				? isoOrNull(plan.lostAt)
				: null,
		lostReason: isLost && !isWon ? plan.lostReason : null,
	};
}

/** Every lead that arrived until `now`, newest first. */
export function listLeads(now: number): Lead[] {
	return listLeadPlans(dayNumberOf(now))
		.filter((plan) => plan.createdAt <= now)
		.map((plan) => leadAt(plan, now))
		.reverse();
}
