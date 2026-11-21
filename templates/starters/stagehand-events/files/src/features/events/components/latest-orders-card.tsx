// The latest orders card of one event: a short table of the newest orders with the buyer, the door status, and the date.
// EventDetailPage renders it under the run of show. Each buyer opens the order panel of the guest list.
// It follows the kit "transaction history" card: a plain table with a status badge per row.
import { Link } from "@tanstack/react-router";
import { AttendanceBadge } from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import type { EventOrder } from "../api/events.queries";

// 6 rows, as in the kit card. The Orders tab lists every order.
const SHOWN_ORDERS = 6;

type LatestOrdersCardProps = {
	/** The orders of the event, the newest first. */
	orders: EventOrder[];
};

/** An event with no order shows one muted sentence. */
export function LatestOrdersCard({ orders }: LatestOrdersCardProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});

	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>{t("events.latestOrders")}</CardTitle>
			</CardHeader>
			<CardContent>
				{orders.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("events.noOrders")}
					</p>
				) : (
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t("attendees.guest")}</TableHead>
									<TableHead>{t("attendees.status")}</TableHead>
									<TableHead className="text-end">{t("events.date")}</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{orders.slice(0, SHOWN_ORDERS).map((order) => (
									<TableRow key={order.id}>
										<TableCell className="max-w-40">
											<Link
												to="/app/attendees"
												search={{ order: order.id }}
												className="block truncate hover:underline"
											>
												{order.buyerName}
											</Link>
										</TableCell>
										<TableCell>
											<AttendanceBadge status={order.status} />
										</TableCell>
										<TableCell className="text-end text-muted-foreground tabular-nums">
											{date.format(order.placedAt)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
