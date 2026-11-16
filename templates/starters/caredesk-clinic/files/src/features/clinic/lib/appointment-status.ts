// The statuses and the visit types of an appointment, and the Badge variant of each status.
// The sample generator, the lists, the board, and the status badge read this file.
// A check constraint of a real `appointments` table holds the same values.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";

/** Every status, in the order of a visit. The label is the message key `appointmentStatuses.<status>`. */
export const APPOINTMENT_STATUSES = [
	"scheduled",
	"confirmed",
	"checked_in",
	"in_progress",
	"completed",
	"no_show",
	"cancelled",
] as const;

/** One status. "scheduled" is a booking that the patient did not confirm yet. */
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Every kind of visit. The label is the message key `visitTypes.<type>`. */
export const VISIT_TYPES = [
	"consultation",
	"follow_up",
	"check_up",
	"vaccination",
	"procedure",
	"therapy",
	"first_visit",
] as const;

/** One kind of visit. "first_visit" is the first appointment of a new patient. */
export type VisitType = (typeof VISIT_TYPES)[number];

/** A Badge variant of the kit. */
export type BadgeVariant = NonNullable<
	VariantProps<typeof badgeVariants>["variant"]
>;

/** Badge variant per status. The patient in the room is the only filled one; a no-show is the only red one. */
export const APPOINTMENT_STATUS_BADGE = {
	scheduled: "outline",
	confirmed: "secondary",
	checked_in: "info",
	in_progress: "default",
	completed: "success",
	no_show: "destructive",
	cancelled: "outline",
} satisfies Record<AppointmentStatus, BadgeVariant>;

/** True while the patient is still expected: the visit did not start and nobody closed it. */
export function isUpcomingStatus(status: AppointmentStatus): boolean {
	return status === "scheduled" || status === "confirmed";
}
