// The other checks of the same table today, in the anatomy of the kit "connections" card.
// OrderDetailPage renders it beside the line summary. Each row links to its check; the header links to the list.
// An open check gets the filled button, so the floor manager sees which check still runs.
import { Link } from "@tanstack/react-router";
import {
	countLabel,
	fillMessage,
	formatClock,
	OPEN_ORDER_STATUSES,
	type Order,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";

// The card shows the 5 latest checks, as the kit card shows 5 rows.
const SHOWN_CHECKS = 5;

type TableChecksCardProps = {
	/** The checks of the same table today, the check of the page left out, newest first. */
	orders: Order[];
};

/** No other check shows one muted sentence. */
export function TableChecksCard({ orders }: TableChecksCardProps) {
	const { t, locale } = useT();

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("orderDetail.sameTable")}</CardTitle>
				<CardAction>
					<Button asChild variant="outline" size="icon">
						<Link to="/app/orders" aria-label={t("orderDetail.back")}>
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{orders.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("orderDetail.sameTableEmpty")}
					</p>
				) : (
					<ul className="grid gap-4">
						{orders.slice(0, SHOWN_CHECKS).map((order) => {
							const isOpen = OPEN_ORDER_STATUSES.includes(order.status);
							return (
								<li
									key={order.id}
									className="flex items-center justify-between gap-3"
								>
									<div className="flex min-w-0 items-center gap-4">
										<span
											aria-hidden="true"
											className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground text-xs"
										>
											{order.tableName}
										</span>
										<div className="grid min-w-0">
											<span className="font-medium tabular-nums">
												#{order.number} · {t(`orderStatuses.${order.status}`)}
											</span>
											<span className="truncate text-muted-foreground text-xs">
												{fillMessage(t("orderDetail.otherCheckMeta"), {
													time: formatClock(order.openedAt, locale),
													covers: countLabel(
														order.covers,
														t("counts.covers.one"),
														t("counts.covers.other"),
														locale,
													),
													server: order.serverName,
												})}
											</span>
										</div>
									</div>
									<Button
										asChild
										size="sm"
										variant={isOpen ? "default" : "outline"}
									>
										<Link
											to="/app/orders/$orderId"
											params={{ orderId: order.id }}
										>
											{t("orderDetail.open")}
										</Link>
									</Button>
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
