// Short texts of one order: its number with the "#" sign, and a one-line summary of its items.
// The order table, the home list, the order page, and the customer panel call them.
import { fillMessage } from "~/features/shop";

/** The order number as the team says it: "#1042". */
export function orderNumberOf(orderId: string): string {
	return `#${orderId}`;
}

/**
 * The first product, then the count of the other lines: "Speckled mug and 2 more".
 * `moreTemplate` is the message `orders.itemsMore`, with {name} and {count}.
 */
export function itemsSummaryOf(
	order: { firstProductName: string; lineCount: number },
	moreTemplate: string,
	number: Intl.NumberFormat,
): string {
	return order.lineCount > 1
		? fillMessage(moreTemplate, {
				name: order.firstProductName,
				count: number.format(order.lineCount - 1),
			})
		: order.firstProductName;
}
