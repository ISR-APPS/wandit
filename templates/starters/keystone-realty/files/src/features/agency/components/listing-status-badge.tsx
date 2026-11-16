// The badge of a listing status: a word and a color.
// The listing tables, the listing detail page, and the lead panel render it.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import type { ListingStatus } from "../lib/sample-listings";
import { LISTING_STATUS_BADGE } from "../lib/status-badges";

type ListingStatusBadgeProps = {
	/** The status of the listing at the time of the read. */
	status: ListingStatus;
};

/** The label is the message `agency.listingStatuses.<status>`. */
export function ListingStatusBadge({ status }: ListingStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={LISTING_STATUS_BADGE[status]}>
			{t(`agency.listingStatuses.${status}`)}
		</Badge>
	);
}
