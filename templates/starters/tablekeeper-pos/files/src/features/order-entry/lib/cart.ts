// The cart of the order screen: the lines of the ticket in progress and their totals.
// OrderEntryPage keeps the lines in React state and calls these pure functions on each tap.
// Nothing here reaches a server. A later mutation inserts the lines into `order_lines`.
import { type MenuItem, vatInsideCents } from "~/features/restaurant";

/** One line of the ticket in progress. */
export type CartLine = {
	menuItemId: string;
	/** Portions, 1 or more. A line at 0 leaves the cart. */
	quantity: number;
};

/** One cart line joined with its menu item. Lines of an unknown item are dropped. */
export type TicketLine = {
	item: MenuItem;
	quantity: number;
	/** Quantity times the menu price, in cents, VAT included. */
	totalCents: number;
};

/** The cart with one more portion of `menuItemId`. A new item goes to the end of the ticket. */
export function addToCart(lines: CartLine[], menuItemId: string): CartLine[] {
	return lines.some((line) => line.menuItemId === menuItemId)
		? lines.map((line) =>
				line.menuItemId === menuItemId
					? { ...line, quantity: line.quantity + 1 }
					: line,
			)
		: [...lines, { menuItemId, quantity: 1 }];
}

/** The cart with `delta` portions more (or fewer) of one item. A quantity of 0 removes the line. */
export function changeQuantity(
	lines: CartLine[],
	menuItemId: string,
	delta: number,
): CartLine[] {
	return lines
		.map((line) =>
			line.menuItemId === menuItemId
				? { ...line, quantity: line.quantity + delta }
				: line,
		)
		.filter((line) => line.quantity > 0);
}

/** The cart lines with their menu items, in the order of the taps. */
export function toTicketLines(
	lines: CartLine[],
	menu: MenuItem[],
): TicketLine[] {
	return lines.flatMap((line) => {
		const item = menu.find((entry) => entry.id === line.menuItemId);
		return item
			? [
					{
						item,
						quantity: line.quantity,
						totalCents: line.quantity * item.priceCents,
					},
				]
			: [];
	});
}

/** The totals of the ticket in cents: the total with VAT, and the VAT inside it. */
export function ticketTotals(lines: TicketLine[]): {
	totalCents: number;
	vatCents: number;
	itemCount: number;
} {
	return lines.reduce(
		(totals, line) => ({
			totalCents: totals.totalCents + line.totalCents,
			vatCents:
				totals.vatCents + vatInsideCents(line.totalCents, line.item.vatRate),
			itemCount: totals.itemCount + line.quantity,
		}),
		{ totalCents: 0, vatCents: 0, itemCount: 0 },
	);
}
