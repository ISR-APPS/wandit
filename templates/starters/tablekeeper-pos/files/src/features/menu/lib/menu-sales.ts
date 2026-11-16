// The sales of each menu item today: portions, sales in cents, and the time of the last order.
// MenuPage calls buildMenuRows with the menu and the checks of the day. Voids do not count.
// The day report counts the same lines, so the "sold today" column and the best sellers agree.
import {
	isCountedOrder,
	lineTotalCents,
	type MenuItem,
	type Order,
} from "~/features/restaurant";

/** One row of the menu table: the item and its sales of the business day. */
export type MenuRow = MenuItem & {
	/** Portions sold today. */
	soldToday: number;
	/** Sales of the item today in cents, VAT included. */
	salesTodayCents: number;
	/** ISO time of the last check that holds the item. null when nobody ordered it today. */
	lastOrderedAt: string | null;
};

/** The menu in its printed order, with the sales of each item. */
export function buildMenuRows(items: MenuItem[], orders: Order[]): MenuRow[] {
	const counted = orders.filter(isCountedOrder);
	return items.map((item) => {
		let soldToday = 0;
		let salesTodayCents = 0;
		let lastOrderedAt: string | null = null;
		for (const order of counted) {
			for (const line of order.lines) {
				if (line.menuItemId !== item.id) {
					continue;
				}
				soldToday += line.quantity;
				salesTodayCents += lineTotalCents(line);
				if (lastOrderedAt === null || order.openedAt > lastOrderedAt) {
					lastOrderedAt = order.openedAt;
				}
			}
		}
		return { ...item, soldToday, salesTodayCents, lastOrderedAt };
	});
}
