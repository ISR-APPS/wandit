// The fixed code lists of the HR desk: departments, employee statuses, time-off types and statuses,
// hiring stages, and position statuses. Each list has a Badge variant or a chart color where a page needs one.
// The sample tables, the query files, and the pages read this file. A later database repeats each list in a check constraint.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";

/** One variant of the kit Badge. */
export type BadgeVariant = NonNullable<
	VariantProps<typeof badgeVariants>["variant"]
>;

/** The six departments, in the order of the org chart. Labels: `departments.<code>`. */
export const DEPARTMENTS = [
	"engineering",
	"product",
	"sales",
	"customer_success",
	"operations",
	"people_finance",
] as const;

/** One department code. */
export type Department = (typeof DEPARTMENTS)[number];

/** Where a person works. Labels: `locations.<code>`. */
export const LOCATIONS = ["lisbon", "berlin", "remote"] as const;

/** One work location code. */
export type WorkLocation = (typeof LOCATIONS)[number];

/** The contract kinds. An intern and a fixed-term contract have an end date. Labels: `contracts.<code>`. */
export const CONTRACTS = ["permanent", "fixed_term", "intern"] as const;

/** One contract code. */
export type Contract = (typeof CONTRACTS)[number];

/** Employee statuses, in the order of the tabs. Labels: `employeeStatuses.<code>`. */
export const EMPLOYEE_STATUSES = [
	"active",
	"probation",
	"on_leave",
	"notice",
] as const;

/** One employee status. */
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

/** Badge per employee status. Notice is the only warning: it starts the leaver checklist. */
export const EMPLOYEE_STATUS_BADGE = {
	active: "success",
	probation: "info",
	on_leave: "secondary",
	notice: "warning",
} satisfies Record<EmployeeStatus, BadgeVariant>;

/** Time-off types. The order is the stack order of the charts, bottom first. Labels: `timeOffTypes.<code>`. */
export const TIME_OFF_TYPES = [
	"vacation",
	"sick",
	"personal",
	"parental",
	"unpaid",
] as const;

/** One time-off type. */
export type TimeOffType = (typeof TIME_OFF_TYPES)[number];

/**
 * Chart token per type, in the order of TIME_OFF_TYPES, so the stacked chart, the legend,
 * and the planner cells show one type in one color.
 */
export const TIME_OFF_TYPE_COLOR = {
	vacation: "var(--chart-1)",
	sick: "var(--chart-3)",
	personal: "var(--chart-2)",
	parental: "var(--chart-4)",
	unpaid: "var(--chart-5)",
} satisfies Record<TimeOffType, string>;

/** Time-off request statuses, in the order of the tabs. Labels: `timeOffStatuses.<code>`. */
export const TIME_OFF_STATUSES = [
	"pending",
	"approved",
	"declined",
	"cancelled",
] as const;

/** One time-off request status. */
export type TimeOffStatus = (typeof TIME_OFF_STATUSES)[number];

/** Badge per request status. Pending is the warning: it waits for a manager. */
export const TIME_OFF_STATUS_BADGE = {
	pending: "warning",
	approved: "success",
	declined: "destructive",
	cancelled: "outline",
} satisfies Record<TimeOffStatus, BadgeVariant>;

/** The stages of the hiring pipeline, in order. Rejected is an end state off the board. Labels: `stages.<code>`. */
export const STAGES = [
	"applied",
	"screening",
	"interview",
	"offer",
	"hired",
	"rejected",
] as const;

/** One hiring stage. */
export type Stage = (typeof STAGES)[number];

/** The stages that the pipeline board shows as columns. */
export const BOARD_STAGES = [
	"applied",
	"screening",
	"interview",
	"offer",
	"hired",
] as const satisfies readonly Stage[];

/** Badge per stage. Offer is the warning: the candidate must answer soon. */
export const STAGE_BADGE = {
	applied: "secondary",
	screening: "info",
	interview: "info",
	offer: "warning",
	hired: "success",
	rejected: "outline",
} satisfies Record<Stage, BadgeVariant>;

/** Where an application comes from. Labels: `sources.<code>`. */
export const SOURCES = [
	"careers_site",
	"referral",
	"job_board",
	"outreach",
	"agency",
] as const;

/** One application source. */
export type Source = (typeof SOURCES)[number];

/** Position statuses. Labels: `positionStatuses.<code>`. */
export const POSITION_STATUSES = ["open", "on_hold", "filled"] as const;

/** One position status. */
export type PositionStatus = (typeof POSITION_STATUSES)[number];

/** Badge per position status. */
export const POSITION_STATUS_BADGE = {
	open: "info",
	on_hold: "secondary",
	filled: "success",
} satisfies Record<PositionStatus, BadgeVariant>;
