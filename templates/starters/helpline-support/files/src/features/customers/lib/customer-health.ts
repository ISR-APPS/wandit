// The health of a customer company: healthy, watch, or at risk, from its ratings and its open tickets.
// The customers page shows it as a badge and filters by it. The CSV export writes it.
import type { CustomerListItem } from "../api/customers.queries";

/** Every health, the best first. Labels: `customers.health.<health>`. */
export const CUSTOMER_HEALTHS = ["healthy", "watch", "at_risk"] as const;

/** One health value. */
export type CustomerHealth = (typeof CUSTOMER_HEALTHS)[number];

// Under this share of good ratings, about one bad rating in four, the company is at risk.
const AT_RISK_SATISFACTION = 0.75;

// From this count of open tickets, the team watches the company: many open cases at one time.
const WATCH_OPEN_TICKETS = 3;

/** Bad ratings weigh more than open tickets, because they show an unhappy customer, not a busy one. */
export function customerHealth(
	customer: Pick<CustomerListItem, "satisfaction" | "openTickets">,
): CustomerHealth {
	if (
		customer.satisfaction !== null &&
		customer.satisfaction < AT_RISK_SATISFACTION
	) {
		return "at_risk";
	}
	return customer.openTickets >= WATCH_OPEN_TICKETS ? "watch" : "healthy";
}
