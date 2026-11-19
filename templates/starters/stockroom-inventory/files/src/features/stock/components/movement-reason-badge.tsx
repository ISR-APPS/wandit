// The badge of a stock movement kind: receipt, pick, count, or damage.
// The movement table and the timeline of the item page render it.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { MOVEMENT_REASON_BADGE, type MovementReason } from "../lib/statuses";

type MovementReasonBadgeProps = {
	reason: MovementReason;
};

/** A word plus a color. Damage is the only red one. */
export function MovementReasonBadge({ reason }: MovementReasonBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={MOVEMENT_REASON_BADGE[reason]}>
			{t(`movementReasons.${reason}`)}
		</Badge>
	);
}
