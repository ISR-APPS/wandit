// The sample viewings of the agency: the visits of a home with a lead and an agent.
// book.ts reads them. Each viewing comes from the plan of its lead in sample-lead-plans.ts.
// A viewing to come waits for a confirmation or is confirmed. A past viewing has its outcome.
// To make it real: this module becomes the table `viewings`.
import { dayNumberOf, HOUR_MS } from "./agency-clock";
import { type LeadPlan, listLeadPlans } from "./sample-lead-plans";
import type { ListingPlan } from "./sample-listings";

/** Every status of a viewing. The label is the message key `agency.viewingStatuses.<status>`. */
export const VIEWING_STATUSES = [
	"requested",
	"confirmed",
	"completed",
	"no_show",
	"cancelled",
] as const;

/** One status of a viewing. "requested" waits for the seller to confirm the time. */
export type ViewingStatus = (typeof VIEWING_STATUSES)[number];

/** How much a lead likes the home after a visit. The label is the message key `agency.viewingInterests.<interest>`. */
export type ViewingInterest = "hot" | "warm" | "cold";

/** The length of every viewing, in minutes. */
export const VIEWING_MINUTES = 30;

/** One viewing, as the pages read it. The times are ISO texts. */
export type Viewing = {
	/** Stable id: the id of the lead and the number of the visit, for example "L-47703-1". */
	id: string;
	leadId: string;
	listingId: string;
	/** The id of the agent who shows the home. */
	agentId: string;
	startsAt: string;
	/** The time the agent booked the visit. */
	bookedAt: string;
	status: ViewingStatus;
	/** 1 for the first visit of the lead, 2 for the second. */
	visitNumber: number;
	/** The interest of the lead after a completed visit. null for every other status. */
	interest: ViewingInterest | null;
	/** The note of the agent after a completed visit. null for every other status. */
	feedback: string | null;
};

// A lead cancels 5 hours before the visit, so the agenda shows the change the same day.
const CANCEL_NOTICE_MS = 5 * HOUR_MS;

/** Every viewing that is booked at the time `now`, by start time, oldest first. */
export function listViewings(now: number): Viewing[] {
	return listLeadPlans(dayNumberOf(now))
		.filter(
			(lead): lead is LeadPlan & { listing: ListingPlan } =>
				lead.listing !== null,
		)
		.flatMap((lead) =>
			lead.viewings
				.filter((viewing) => viewing.bookedAt <= now)
				.map((viewing): Viewing => {
					const isPast = viewing.startsAt <= now;
					const isCancelled =
						viewing.outcome === "cancelled" &&
						viewing.startsAt - CANCEL_NOTICE_MS <= now;
					const status: ViewingStatus = isCancelled
						? "cancelled"
						: isPast
							? viewing.outcome
							: viewing.confirmedAt <= now
								? "confirmed"
								: "requested";
					return {
						id: `${lead.id}-${viewing.index}`,
						leadId: lead.id,
						listingId: lead.listing.id,
						agentId: lead.agentId,
						startsAt: new Date(viewing.startsAt).toISOString(),
						bookedAt: new Date(viewing.bookedAt).toISOString(),
						status,
						visitNumber: viewing.index,
						interest: status === "completed" ? viewing.interest : null,
						feedback: status === "completed" ? viewing.feedback : null,
					};
				}),
		)
		.sort(
			(first, second) =>
				Date.parse(first.startsAt) - Date.parse(second.startsAt),
		);
}
