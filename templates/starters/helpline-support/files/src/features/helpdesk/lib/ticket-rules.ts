// The words and the rules of a ticket: statuses, priorities, SLA targets, channels, topics, and customer plans.
// The sample tables, the query files, and every page read this file. Each list is also a later check constraint.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";

/** Every status, in the order of the work. The tabs follow this order. Labels: `tickets.statuses.<status>`. */
export const TICKET_STATUSES = [
	"new",
	"open",
	"pending",
	"solved",
	"closed",
] as const;

/** One status. "pending" waits for the customer, so its SLA clock stops. */
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** The statuses that the team still works on. The home figures, the bell, and the late count use them. */
export const OPEN_STATUSES = ["new", "open", "pending"] as const;

/** True for a ticket that is in the queue. Solved and closed tickets are done. */
export function isOpenStatus(status: TicketStatus): boolean {
	return OPEN_STATUSES.some((open) => open === status);
}

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Badge variant per status. New needs a first reply soon, so it is the warning one. */
export const TICKET_STATUS_BADGE = {
	new: "warning",
	open: "info",
	pending: "secondary",
	solved: "success",
	closed: "outline",
} satisfies Record<TicketStatus, BadgeVariant>;

/** Every priority, the most urgent first. Labels: `tickets.priorities.<priority>`. */
export const TICKET_PRIORITIES = ["urgent", "high", "normal", "low"] as const;

/** One priority. It sets the SLA targets below. */
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

/** Minutes from the creation to the first agent reply, per priority. A new ticket is late after it. */
export const FIRST_REPLY_TARGET_MINUTES = {
	urgent: 60,
	high: 120,
	normal: 480,
	low: 1_440,
} satisfies Record<TicketPriority, number>;

/** Minutes from the creation to the solve, per priority. An open ticket is late after it. */
export const RESOLUTION_TARGET_MINUTES = {
	urgent: 480,
	high: 1_440,
	normal: 2_880,
	low: 5_760,
} satisfies Record<TicketPriority, number>;

/** Where a ticket comes from. Labels: `tickets.channels.<channel>`. */
export const TICKET_CHANNELS = ["email", "chat", "web_form", "phone"] as const;

/** One channel. */
export type TicketChannel = (typeof TICKET_CHANNELS)[number];

/** What a ticket is about. "other" collects the rest. Labels: `topics.<topic>`. */
export const TICKET_TOPICS = [
	"billing",
	"access",
	"integrations",
	"bug",
	"how_to",
	"other",
] as const;

/** One topic. The breakdown of the home and the collections of the articles use it. */
export type TicketTopic = (typeof TICKET_TOPICS)[number];

/** The plans that a customer company pays for, the smallest first. Labels: `customers.plans.<plan>`. */
export const CUSTOMER_PLANS = [
	"starter",
	"growth",
	"scale",
	"enterprise",
] as const;

/** One plan. */
export type CustomerPlan = (typeof CUSTOMER_PLANS)[number];

/** Price of one seat per month, in whole units of CURRENCY (format.ts). MRR is seats times this price. */
export const PLAN_SEAT_PRICE = {
	starter: 12,
	growth: 24,
	scale: 39,
	enterprise: 52,
} satisfies Record<CustomerPlan, number>;

/** Badge variant per plan. Only enterprise stands out; the other plans stay calm. */
export const PLAN_BADGE = {
	starter: "outline",
	growth: "secondary",
	scale: "info",
	enterprise: "default",
} satisfies Record<CustomerPlan, BadgeVariant>;

/**
 * The next SLA deadline of a ticket, as ISO, or null when no clock runs.
 * New: the first reply target. Open: the resolution target. Pending, solved, closed: no deadline.
 */
export function slaDueAt(
	status: TicketStatus,
	priority: TicketPriority,
	createdAt: string,
): string | null {
	const created = Date.parse(createdAt);
	if (status === "new") {
		return new Date(
			created + FIRST_REPLY_TARGET_MINUTES[priority] * 60_000,
		).toISOString();
	}
	if (status === "open") {
		return new Date(
			created + RESOLUTION_TARGET_MINUTES[priority] * 60_000,
		).toISOString();
	}
	return null;
}

/** True when an open ticket passed its SLA deadline. A ticket with no deadline is never late. */
export function isLate(dueAt: string | null, now: number): boolean {
	return dueAt !== null && Date.parse(dueAt) < now;
}
