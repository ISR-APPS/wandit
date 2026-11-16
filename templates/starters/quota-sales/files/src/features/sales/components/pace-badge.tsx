// The badge of a pace status: Ahead, On pace, or Behind.
// The reps list, the rep page, and the targets page show it next to an attainment.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { PACE_BADGE, type PaceStatus } from "../lib/pace";

type PaceBadgeProps = {
	status: PaceStatus;
};

/** A word plus a color, never a color alone. */
export function PaceBadge({ status }: PaceBadgeProps) {
	const { t } = useT();
	return <Badge variant={PACE_BADGE[status]}>{t(`pace.${status}`)}</Badge>;
}
