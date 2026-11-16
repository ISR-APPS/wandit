// The status of a member and the phase of a class session, with the Badge variant of each value.
// The home, the members pages, and the classes page read these maps through ~/features/gym.
// A phase follows the clock; a member status is a stored value.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";
import type { MemberStatus } from "./sample-members";
import type { SessionRow } from "./session-rows";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/**
 * Classes for a badge that is no news: a muted fill on the outline variant.
 * The outline border looks like a button in this theme, and the secondary fill is near-white.
 */
export const QUIET_BADGE_CLASS =
	"border-transparent bg-muted text-muted-foreground hover:bg-muted hover:text-muted-foreground";

/** Badge variant per member status. Active is green. MemberStatusBadge mutes "lapsed": it is no alarm. */
export const MEMBER_STATUS_BADGE = {
	active: "success",
	frozen: "info",
	lapsed: "outline",
} satisfies Record<MemberStatus, BadgeVariant>;

/**
 * done: ended. live: running now. open: ahead with free spots. full: ahead with no free spot.
 * Its label is the message key `sessionPhases.<phase>`.
 */
export type SessionPhase = "done" | "live" | "open" | "full" | "cancelled";

/** Badge variant per phase. The live class gets the accent fill. SessionPhaseBadge mutes "done" with its own fill. */
export const SESSION_PHASE_BADGE = {
	done: "outline",
	live: "default",
	open: "info",
	full: "warning",
	cancelled: "destructive",
} satisfies Record<SessionPhase, BadgeVariant>;

/** The phase of a session at `now` (milliseconds since 1970). */
export function sessionPhaseAt(session: SessionRow, now: number): SessionPhase {
	if (session.isCancelled) {
		return "cancelled";
	}
	if (session.endsAt <= now) {
		return "done";
	}
	if (session.startsAt <= now) {
		return "live";
	}
	return session.roster.length >= session.capacity ? "full" : "open";
}
