// The badge of one member status: Active, Frozen, or Lapsed.
// The members list and the member page render it beside the name.
// It reads the variant map of statuses.ts and the labels `memberStatuses.<status>`.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import type { MemberStatus } from "../lib/sample-members";
import { MEMBER_STATUS_BADGE, QUIET_BADGE_CLASS } from "../lib/statuses";

type MemberStatusBadgeProps = {
	/** The stored status of the member row. */
	status: MemberStatus;
	/** Layout classes of the caller, for example a margin or a breakpoint. */
	className?: string;
};

/** A lapsed member gets the muted fill of QUIET_BADGE_CLASS. */
export function MemberStatusBadge({
	status,
	className,
}: MemberStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge
			variant={MEMBER_STATUS_BADGE[status]}
			className={cn(status === "lapsed" && QUIET_BADGE_CLASS, className)}
		>
			{t(`memberStatuses.${status}`)}
		</Badge>
	);
}
