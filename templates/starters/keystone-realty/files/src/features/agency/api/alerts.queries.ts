// Reads of the header alerts: the late leads and the viewings that wait for a confirmation, the oldest first.
// HeaderNotifications reads it after the shell renders. The rules come from book.ts:
// a late lead is a "new" lead past the answer target, the same rows as the "New" filter of the leads page.
// The queryFn reads the sample rows. To make it real: replace its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { readLeadRows, readViewingRows } from "../lib/book";
import { addressOf } from "../lib/format";

// A late lead opens its panel on the leads page. linkOptions types the path, so a wrong path fails typecheck.
function leadLink(leadId: string) {
	return linkOptions({ to: "/app/leads", search: { lead: leadId } });
}

// A viewing to confirm opens the page of its home.
function listingLink(listingId: string) {
	return linkOptions({
		to: "/app/listings/$listingId",
		params: { listingId },
	});
}

/** One alert of the bell menu. */
export type Alert = {
	id: string;
	/** "lateLead": a lead with no answer past the target. "toConfirm": a viewing to come that the seller did not confirm. */
	kind: "lateLead" | "toConfirm";
	/** The lead name, or the address of the home. */
	title: string;
	/** The home that the lead asks about, or the lead of the viewing. */
	detail: string;
	/** ISO time: the arrival of the lead, or the start of the viewing. */
	at: string;
	link: ReturnType<typeof leadLink> | ReturnType<typeof listingLink>;
};

/** Every alert, the oldest first. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const now = Date.now();
			const lateLeads: Alert[] = readLeadRows(now)
				.filter((lead) => lead.isLate)
				.map((lead) => ({
					id: lead.id,
					kind: "lateLead",
					title: lead.fullName,
					detail: lead.listingStreet ?? lead.area,
					at: lead.createdAt,
					link: leadLink(lead.id),
				}));
			const toConfirm: Alert[] = readViewingRows(now)
				.filter(
					(viewing) =>
						viewing.status === "requested" &&
						Date.parse(viewing.startsAt) > now,
				)
				.map((viewing) => ({
					id: viewing.id,
					kind: "toConfirm",
					title: addressOf({
						street: viewing.listingStreet,
						unit: viewing.listingUnit,
					}),
					detail: viewing.leadName,
					at: viewing.startsAt,
					link: listingLink(viewing.listingId),
				}));
			return [...lateLeads, ...toConfirm].sort((first, second) =>
				first.at.localeCompare(second.at),
			);
		},
	});
}
