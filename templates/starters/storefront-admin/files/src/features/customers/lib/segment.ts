// The segments of a customer and the rule that puts a customer in one.
// The customer query calls segmentOf. The customer table and the customer panel show the result.
import { type BadgeVariant, DAY_MS } from "~/features/shop";

/** Every segment. The tabs of the customer list follow this order. */
export const CUSTOMER_SEGMENTS = ["new", "loyal", "active", "lapsed"] as const;

/** One segment. Its label is the message key `customers.segments.<segment>`. */
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

/** Badge variant per segment. Lapsed is the one that asks for an action. */
export const SEGMENT_BADGE = {
	new: "info",
	loyal: "success",
	active: "secondary",
	lapsed: "warning",
} satisfies Record<CustomerSegment, BadgeVariant>;

/** A customer is new for this count of days after the first order. */
export const NEW_FOR_DAYS = 30;
/** A customer with no order for this count of days is lapsed. */
export const LAPSED_AFTER_DAYS = 60;
/** A customer with this count of orders, or more, is loyal. A pantry shop sees about one order a month from a regular. */
export const LOYAL_FROM_ORDERS = 5;

/**
 * Product rule, the first match wins: new (first order in the last 30 days), lapsed (no order for 60 days),
 * loyal (5 orders or more), else active. `now` is in milliseconds since 1970.
 */
export function segmentOf(
	customer: { joinedAt: string; lastOrderAt: string; orderCount: number },
	now: number,
): CustomerSegment {
	if (now - Date.parse(customer.joinedAt) <= NEW_FOR_DAYS * DAY_MS) {
		return "new";
	}
	if (now - Date.parse(customer.lastOrderAt) > LAPSED_AFTER_DAYS * DAY_MS) {
		return "lapsed";
	}
	return customer.orderCount >= LOYAL_FROM_ORDERS ? "loyal" : "active";
}
