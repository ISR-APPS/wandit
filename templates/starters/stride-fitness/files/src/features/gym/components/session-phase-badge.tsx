// The badge of one class session phase: Done, Live, Open, Full, or Cancelled.
// The home agenda, the timetable, and the roster panel of the classes page render it.
// It reads the variant map of statuses.ts and the labels `sessionPhases.<phase>`.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import {
	QUIET_BADGE_CLASS,
	SESSION_PHASE_BADGE,
	type SessionPhase,
} from "../lib/statuses";

type SessionPhaseBadgeProps = {
	/** The phase at the current time, from sessionPhaseAt(). */
	phase: SessionPhase;
	/** Layout classes of the caller, for example a width or a breakpoint. */
	className?: string;
};

/** An ended class gets the muted fill of QUIET_BADGE_CLASS. */
export function SessionPhaseBadge({
	phase,
	className,
}: SessionPhaseBadgeProps) {
	const { t } = useT();
	return (
		<Badge
			variant={SESSION_PHASE_BADGE[phase]}
			className={cn(phase === "done" && QUIET_BADGE_CLASS, className)}
		>
			{t(`sessionPhases.${phase}`)}
		</Badge>
	);
}
