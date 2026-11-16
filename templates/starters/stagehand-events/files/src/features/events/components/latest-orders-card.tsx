// The newest orders of one event. Each row opens that order in the guest list of the event.
// EventDetailPage renders it at the end of the rail. Each row shows the buyer, the tier, the count, and the amount.
import { Link } from "@tanstack/react-router";
import {
	countLabel,
	formatRelativeTime,
	initialsOf,
	moneyFormat,
	type Order,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type LatestOrdersCardProps = {
	/** The id of the event, for the guest list links. */
	eventId: string;
	/** The newest orders first. */
	orders: Order[];
	/** The time of the load, in milliseconds since 1970. */
	now: number;
};

/** A refunded order keeps its row, with its amount struck through. A row click opens its guest panel. */
export function LatestOrdersCard({
	eventId,
	orders,
	now,
}: LatestOrdersCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("events.latestOrders")}</CardTitle>
			</CardHeader>
			<CardContent>
				{orders.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("events.noOrders")}
					</p>
				) : (
					<ul className="-mx-2 grid gap-1">
						{orders.map((order) => (
							<li key={order.id}>
								<Link
									to="/app/attendees"
									search={{ event: eventId, order: order.id }}
									className="flex items-center gap-3 rounded-control px-2 py-1.5 outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
								>
									<Avatar className="size-8">
										<AvatarFallback className="text-xs">
											{initialsOf(order.buyerName)}
										</AvatarFallback>
									</Avatar>
									<div className="grid min-w-0 flex-1 justify-items-start">
										<span
											className="max-w-full truncate font-medium text-sm"
											dir="auto"
										>
											{order.buyerName}
										</span>
										<span className="max-w-full truncate text-muted-foreground text-xs">
											{countLabel(
												order.quantity,
												t("attendees.ticketOne"),
												t("attendees.ticketOther"),
												locale,
											)}
											{" · "}
											<bdi>{order.tierName}</bdi>
											{" · "}
											{formatRelativeTime(order.placedAt, now, locale)}
										</span>
									</div>
									<span
										className={
											order.refundedAt === null
												? "text-sm tabular-nums"
												: "text-muted-foreground text-sm tabular-nums line-through"
										}
									>
										{money.format(order.amount)}
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
