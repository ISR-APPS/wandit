// The recent orders card of the home: the newest orders of every event as a feed, and a "View all" button.
// OverviewPage renders it at the start of the third row. Each row opens the order panel of the guest list.
// It follows the kit "recent activities" card and recipe 3.5 (activity feed with initials avatars).
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	fillMessage,
	formatRelativeTime,
	initialsOf,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import { recentOrdersQueryOptions } from "../api/overview.queries";

/** Reads its own query, which the home loader prefetches. */
export function RecentOrdersCard() {
	const { t, locale } = useT();
	const { data: orders } = useSuspenseQuery(recentOrdersQueryOptions());
	const now = Date.now();

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.recentOrders")}</CardTitle>
			</CardHeader>
			<CardContent className="grid flex-1 content-between gap-4">
				{orders.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("overview.noOrders")}
					</p>
				) : (
					<ul className="grid gap-1">
						{orders.map((order) => (
							<li key={order.id}>
								<Link
									to="/app/attendees"
									search={{ order: order.id }}
									className="-mx-2 flex items-center gap-3 rounded-md p-2 hover:bg-accent"
								>
									<Avatar className="size-9">
										<AvatarFallback className="bg-muted text-xs">
											{initialsOf(order.buyerName)}
										</AvatarFallback>
									</Avatar>
									<span className="grid min-w-0 flex-1 gap-0.5">
										<span className="flex items-center gap-2">
											<span className="truncate font-medium text-sm">
												{order.buyerName}
											</span>
											{order.refundedAt === null ? null : (
												<Badge variant="outline">
													{t("attendees.statuses.refunded")}
												</Badge>
											)}
										</span>
										<span className="truncate text-muted-foreground text-sm">
											{fillMessage(t("overview.orderLine"), {
												quantity: order.quantity,
												tier: order.tierName,
												event: order.eventName,
											})}
										</span>
									</span>
									<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
										{formatRelativeTime(order.placedAt, now, locale)}
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}
				<Button asChild variant="outline" size="sm" className="w-full">
					<Link to="/app/attendees">
						{t("common.viewAll")}
						<CaretRightIcon className="rtl:rotate-180" />
					</Link>
				</Button>
			</CardContent>
		</Card>
	);
}
