// The door status Badge of one order: expected, checked in, no-show, or refunded.
// The guest list, the guest panel, and the latest orders of an event render it.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import type { AttendanceStatus } from "../lib/box-office";
import { ATTENDANCE_BADGE } from "../lib/status-badges";

type AttendanceBadgeProps = {
	status: AttendanceStatus;
};

/** The word comes from `attendees.statuses.<status>`. */
export function AttendanceBadge({ status }: AttendanceBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={ATTENDANCE_BADGE[status]}>
			{t(`attendees.statuses.${status}`)}
		</Badge>
	);
}
