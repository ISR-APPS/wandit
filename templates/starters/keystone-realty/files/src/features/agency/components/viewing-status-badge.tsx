// The badge of a viewing status: a word and a color.
// The agenda, the past viewings table, and the viewing list of a listing render it.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import type { ViewingStatus } from "../lib/sample-viewings";
import { VIEWING_STATUS_BADGE } from "../lib/status-badges";

type ViewingStatusBadgeProps = {
	/** The status of the viewing at the time of the read. */
	status: ViewingStatus;
};

/** The label is the message `agency.viewingStatuses.<status>`. */
export function ViewingStatusBadge({ status }: ViewingStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={VIEWING_STATUS_BADGE[status]}>
			{t(`agency.viewingStatuses.${status}`)}
		</Badge>
	);
}
