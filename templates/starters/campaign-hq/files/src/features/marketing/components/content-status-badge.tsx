// The status word of a calendar item in a colored badge: Drafting, In review, Scheduled, or Published.
// The calendar item dialog, the calendar rail, and the campaign content panel render it.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { CONTENT_STATUS_BADGE, type ContentStatus } from "../lib/content";

type ContentStatusBadgeProps = {
	status: ContentStatus;
};

/** A status is a word plus a color, never a color alone. */
export function ContentStatusBadge({ status }: ContentStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={CONTENT_STATUS_BADGE[status]}>
			{t(`contentStatus.${status}`)}
		</Badge>
	);
}
