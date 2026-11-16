// Says in one line what a lead wants: a named home, a home in a district, or a valuation.
// The leads table, the lead panel, and the attention list of the home call it.
import { fillMessage, type LeadRow } from "~/features/agency";
import type { TranslationKey } from "~/shared/i18n";

/**
 * The street of the home for a buyer who asks about a listing, for example "66 Marigold Street".
 * Else a sentence with the district: "Looking in Old Mill" or "Valuation in Old Mill".
 */
export function describeInterest(
	lead: LeadRow,
	t: (key: TranslationKey) => string,
): string {
	if (lead.listingStreet !== null) {
		return lead.listingStreet;
	}
	return fillMessage(
		t(lead.interest === "sell" ? "leads.valuationIn" : "leads.lookingIn"),
		{ area: lead.area },
	);
}
