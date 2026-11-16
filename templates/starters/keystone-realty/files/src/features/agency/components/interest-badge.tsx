// The badge of the interest of a lead after a visit: hot, warm, or cold.
// The feedback list, the past viewings table, and the viewing list of a listing render it.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import type { ViewingInterest } from "../lib/sample-viewings";
import { VIEWING_INTEREST_BADGE } from "../lib/status-badges";

type InterestBadgeProps = {
	/** The interest that the agent wrote down after a completed visit. */
	interest: ViewingInterest;
};

/** The label is the message `agency.viewingInterests.<interest>`. */
export function InterestBadge({ interest }: InterestBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={VIEWING_INTEREST_BADGE[interest]}>
			{t(`agency.viewingInterests.${interest}`)}
		</Badge>
	);
}
