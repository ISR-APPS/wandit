// The top buyers card of one event: the 5 buyers with the most valid tickets, with their email and an "Open" button.
// EventDetailPage renders it beside the latest orders. "Open" shows the newest order of the buyer in the guest list.
// It follows the kit "connections" card: an avatar list with one action button per row.
import { Link } from "@tanstack/react-router";
import { countLabel, initialsOf } from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { EventOrder } from "../api/events.queries";

// 5 rows, as in the kit card.
const SHOWN_BUYERS = 5;

type TopBuyersCardProps = {
	/** The orders of the event, the newest first. */
	orders: EventOrder[];
};

/** A buyer is one email. Refunded orders do not count. */
export function TopBuyersCard({ orders }: TopBuyersCardProps) {
	const { t, locale } = useT();
	const buyers = new Map<
		string,
		{ name: string; email: string; tickets: number; newestOrderId: string }
	>();
	// The orders come newest first, so the first order of a buyer is the newest one.
	for (const order of orders) {
		if (order.status === "refunded") {
			continue;
		}
		const buyer = buyers.get(order.buyerEmail);
		if (buyer) {
			buyer.tickets += order.quantity;
		} else {
			buyers.set(order.buyerEmail, {
				name: order.buyerName,
				email: order.buyerEmail,
				tickets: order.quantity,
				newestOrderId: order.id,
			});
		}
	}
	const top = [...buyers.values()]
		.sort((first, second) => second.tickets - first.tickets)
		.slice(0, SHOWN_BUYERS);

	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>{t("events.topBuyers")}</CardTitle>
			</CardHeader>
			<CardContent>
				{top.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("events.noOrders")}
					</p>
				) : (
					<ul className="grid gap-4">
						{top.map((buyer) => (
							<li key={buyer.email} className="flex items-center gap-3">
								<Avatar className="size-9">
									<AvatarFallback className="bg-muted text-xs">
										{initialsOf(buyer.name)}
									</AvatarFallback>
								</Avatar>
								<span className="grid min-w-0 flex-1 gap-0.5">
									<span className="truncate font-medium text-sm">
										{buyer.name}
									</span>
									<span className="truncate text-muted-foreground text-xs">
										{`${countLabel(buyer.tickets, t("attendees.ticketOne"), t("attendees.ticketOther"), locale)} · ${buyer.email}`}
									</span>
								</span>
								<Button asChild variant="outline" size="sm">
									<Link
										to="/app/attendees"
										search={{ order: buyer.newestOrderId }}
									>
										{t("table.open")}
									</Link>
								</Button>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
