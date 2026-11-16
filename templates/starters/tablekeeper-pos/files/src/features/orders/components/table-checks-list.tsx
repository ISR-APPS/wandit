// A list of checks of one table: the number, the opening time, the status, and the total. A row opens the check.
// OrderDetailPage renders it for the other checks of the table. The table panel of the floor renders it too.
// It reads the orders that the caller passes. It writes nothing.
import { Link } from "@tanstack/react-router";
import {
	formatCents,
	formatClock,
	moneyFormat,
	ORDER_STATUS_BADGE,
	type Order,
	orderTotalCents,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";

type TableChecksListProps = {
	/** The checks to list, newest first, as the orders query returns them. */
	orders: Order[];
	/** The muted sentence when `orders` is empty. */
	emptyText: string;
};

/** A divided list of link rows, each at least 44 px high. */
export function TableChecksList({ orders, emptyText }: TableChecksListProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	if (orders.length === 0) {
		return <p className="text-muted-foreground text-sm">{emptyText}</p>;
	}
	return (
		<ul className="grid divide-y">
			{orders.map((order) => (
				<li key={order.id}>
					<Link
						to="/app/orders/$orderId"
						params={{ orderId: order.id }}
						className="-mx-2 flex min-h-11 items-center gap-3 rounded-control px-2 py-2 text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
					>
						<span className="w-14 font-medium tabular-nums">
							#{order.number}
						</span>
						<span className="w-16 text-muted-foreground tabular-nums">
							{formatClock(order.openedAt, locale)}
						</span>
						<Badge variant={ORDER_STATUS_BADGE[order.status]}>
							{t(`orderStatuses.${order.status}`)}
						</Badge>
						<span
							className={
								order.status === "void"
									? "ms-auto text-muted-foreground tabular-nums line-through"
									: "ms-auto tabular-nums"
							}
						>
							{formatCents(money, orderTotalCents(order))}
						</span>
					</Link>
				</li>
			))}
		</ul>
	);
}
