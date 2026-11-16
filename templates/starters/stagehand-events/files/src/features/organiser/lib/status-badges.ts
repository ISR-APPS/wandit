// The Badge variant of each event status and of each door status.
// The event and guest badges of this feature read these maps.
// Rule: success is done or healthy, info is in progress, warning needs action soon, outline is closed.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";
import type { AttendanceStatus, EventStatus } from "./box-office";

/** One variant of the kit Badge. */
export type BadgeVariant = NonNullable<
	VariantProps<typeof badgeVariants>["variant"]
>;

/**
 * Badge variant per event status. "live" uses the primary color: the show runs now.
 * "cancelled" is an outline badge like "completed": the refunds run by themselves, so it needs no action.
 */
export const EVENT_STATUS_BADGE = {
	announced: "secondary",
	on_sale: "info",
	sold_out: "success",
	live: "default",
	completed: "outline",
	cancelled: "outline",
} satisfies Record<EventStatus, BadgeVariant>;

/** Badge variant per door status. A no-show needs a follow-up, so it is a warning. */
export const ATTENDANCE_BADGE = {
	expected: "secondary",
	checked_in: "success",
	no_show: "warning",
	refunded: "outline",
} satisfies Record<AttendanceStatus, BadgeVariant>;
