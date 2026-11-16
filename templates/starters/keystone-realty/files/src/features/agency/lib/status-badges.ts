// The Badge variant of each status of the agency: listings, leads, viewings, and the interest after a visit.
// The badge components of this feature read these maps. A status is always a word and a color.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";
import type { LeadStatus } from "./sample-leads";
import type { ListingStatus } from "./sample-listings";
import type { ViewingInterest, ViewingStatus } from "./sample-viewings";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Badge variant per listing status. On the market is blue, an accepted offer is amber, a sale is green. */
export const LISTING_STATUS_BADGE = {
	coming_soon: "secondary",
	active: "info",
	under_offer: "warning",
	sold: "success",
	withdrawn: "outline",
} satisfies Record<ListingStatus, BadgeVariant>;

/** Badge variant per lead status. "offer" is the only filled one: it is the lead closest to a sale. */
export const LEAD_STATUS_BADGE = {
	new: "warning",
	contacted: "secondary",
	viewing: "info",
	offer: "default",
	won: "success",
	lost: "outline",
} satisfies Record<LeadStatus, BadgeVariant>;

/** Badge variant per viewing status. A viewing that waits for a confirmation is amber. */
export const VIEWING_STATUS_BADGE = {
	requested: "warning",
	confirmed: "info",
	completed: "success",
	no_show: "destructive",
	cancelled: "outline",
} satisfies Record<ViewingStatus, BadgeVariant>;

/**
 * Badge variant per interest after a visit: green, amber, then blue.
 * Red stays for "act now" (late, no-show) and the filled accent for the lead with an offer.
 */
export const VIEWING_INTEREST_BADGE = {
	hot: "success",
	warm: "warning",
	cold: "info",
} satisfies Record<ViewingInterest, BadgeVariant>;
