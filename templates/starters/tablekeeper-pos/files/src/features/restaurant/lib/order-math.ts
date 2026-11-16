// The money math of a check: line totals, the subtotal, the VAT inside it, and the total with the tip.
// Every page that shows an amount of a check calls these functions, so the floor, the orders, and the report agree.
// All amounts are whole cents. Menu prices include VAT, so the VAT is a share of the subtotal, not an addition.
import type { Order, OrderLine } from "./sample-orders";

/** Quantity times unit price, in cents. */
export function lineTotalCents(line: OrderLine): number {
	return line.quantity * line.unitPriceCents;
}

/** Sum of the lines in cents, VAT included, tip excluded. This is the "sales" figure of every page. */
export function orderSubtotalCents(order: Order): number {
	return order.lines.reduce((sum, line) => sum + lineTotalCents(line), 0);
}

/** VAT inside an amount that includes it, in whole cents. 110 at a rate of 0.1 holds 10. The cart calls it too. */
export function vatInsideCents(totalCents: number, rate: number): number {
	return Math.round((totalCents * rate) / (1 + rate));
}

/** VAT inside one line, in cents. */
export function lineVatCents(line: OrderLine): number {
	return vatInsideCents(lineTotalCents(line), line.vatRate);
}

/** VAT inside the whole check, in cents. */
export function orderVatCents(order: Order): number {
	return order.lines.reduce((sum, line) => sum + lineVatCents(line), 0);
}

/** What the guest pays: the subtotal plus the card tip, in cents. */
export function orderTotalCents(order: Order): number {
	return orderSubtotalCents(order) + order.tipCents;
}

/** Count of portions on the check, all lines together. */
export function orderItemCount(order: Order): number {
	return order.lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** False for a void. A void stays in the list but never counts in sales, covers, or checks. */
export function isCountedOrder(order: Order): boolean {
	return order.status !== "void";
}
