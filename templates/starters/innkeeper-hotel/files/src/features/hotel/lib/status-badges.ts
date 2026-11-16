// The Badge variant of each reservation status and of each housekeeping status.
// The reservation pages, the guest panel, the room panel, and the housekeeping page read this file.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";
import type { TaskStatus } from "./sample-housekeeping";
import type { ReservationStatus } from "./sample-reservations";

/** A look of the kit Badge. */
export type BadgeVariant = NonNullable<
	VariantProps<typeof badgeVariants>["variant"]
>;

/** Badge variant per reservation status. In house is the only green one, a no-show the only red one. */
export const RESERVATION_STATUS_BADGE = {
	pending: "warning",
	confirmed: "info",
	checked_in: "success",
	checked_out: "secondary",
	cancelled: "outline",
	no_show: "destructive",
} satisfies Record<ReservationStatus, BadgeVariant>;

/** Badge variant per task status. */
export const TASK_STATUS_BADGE = {
	todo: "secondary",
	in_progress: "info",
	done: "success",
	blocked: "destructive",
} satisfies Record<TaskStatus, BadgeVariant>;
