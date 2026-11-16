// The segment badge of a customer: new, loyal, active, or lapsed.
// The customer table and the customer panel render it.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { type CustomerSegment, SEGMENT_BADGE } from "../lib/segment";

type SegmentBadgeProps = {
	/** The segment of the customer row, from segmentOf. */
	segment: CustomerSegment;
};

/** A word plus a color, never a color alone. */
export function SegmentBadge({ segment }: SegmentBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={SEGMENT_BADGE[segment]}>
			{t(`customers.segments.${segment}`)}
		</Badge>
	);
}
