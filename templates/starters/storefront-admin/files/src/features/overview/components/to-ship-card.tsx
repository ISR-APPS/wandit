// The list of the home: the orders that wait for a parcel, the most urgent first.
// OverviewPage renders it with the orders to ship of the order list query. A row opens the order page.
// It follows the list slot of the home "hero" of the app-dashboard skill.
import { LightningIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	itemsSummaryOf,
	type Order,
	orderNumberOf,
	ShelfStageBadge,
	shelfStageOf,
} from "~/features/orders";
import {
	CustomerAvatar,
	dateTimeFormat,
	fillMessage,
	formatRelativeTime,
	moneyFormat,
} from "~/features/shop";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { ArrowRightIcon } from "~/shared/ui/icons";

// 6 rows keep the list on the first screen of a laptop. "See all" opens the rest.
const LIST_ROWS = 6;

type ToShipCardProps = {
	/** Every order with the status "to_ship", the most urgent first. */
	orders: Order[];
};

/** The header count is the count of `orders`: the same number as the "To ship" tab of the order list. */
export function ToShipCard({ orders }: ToShipCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const dateTime = dateTimeFormat(locale);
	const now = Date.now();

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.toShip")}</CardTitle>
				<CardDescription>
					{orders.length === 0
						? t("overview.toShipNone")
						: fillMessage(
								t(
									orders.length > LIST_ROWS
										? "overview.toShipFirst"
										: "overview.toShipAll",
								),
								{
									count: number.format(orders.length),
									shown: number.format(LIST_ROWS),
								},
							)}
				</CardDescription>
				<CardAction>
					<Button
						asChild
						variant="ghost"
						size="sm"
						className="-me-2 max-sm:min-h-11"
					>
						<Link to="/app/orders" search={{ status: "to_ship" }}>
							{t("overview.seeAll")}
							<ArrowRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			{orders.length === 0 ? null : (
				<CardContent>
					<ul className="grid divide-y border-t">
						{orders.slice(0, LIST_ROWS).map((order) => {
							const stage = shelfStageOf(order, now);
							return (
								<li
									key={order.id}
									className="grid @3xl/main:grid-cols-[minmax(0,5fr)_minmax(0,6fr)_8rem_5.5rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-3"
								>
									<div className="flex min-w-0 items-center gap-3">
										<CustomerAvatar
											name={order.customerName}
											className="size-9"
										/>
										<div className="grid min-w-0 justify-items-start gap-0.5">
											<span className="flex items-center gap-1.5">
												<Link
													to="/app/orders/$orderId"
													params={{ orderId: order.id }}
													// On a phone the link gets a touch area of 44 px with no change of the row height.
													className="relative font-medium text-sm tabular-nums hover:underline max-sm:before:absolute max-sm:before:-inset-3"
												>
													{orderNumberOf(order.id)}
												</Link>
												{order.shippingMethod === "express" ? (
													<LightningIcon
														role="img"
														aria-hidden={false}
														aria-label={t("orders.shipping.express")}
														className="size-3.5 text-warning"
													/>
												) : null}
												{/* On a phone the stage sits beside the number: the row has no stage column there. */}
												{stage ? (
													<span className="@3xl/main:hidden">
														<ShelfStageBadge stage={stage} />
													</span>
												) : null}
											</span>
											<span
												className="max-w-full truncate text-muted-foreground text-xs"
												dir="auto"
											>
												{`${order.customerName} · ${order.customerPlace}`}
											</span>
										</div>
									</div>
									<div className="@3xl/main:grid hidden min-w-0 gap-0.5">
										<span className="truncate text-sm">
											{itemsSummaryOf(order, t("orders.itemsMore"), number)}
										</span>
										<span className="text-muted-foreground text-xs">
											{`${fillMessage(
												t(
													order.unitCount === 1
														? "orders.unitsOne"
														: "orders.unitsMany",
												),
												{ count: number.format(order.unitCount) },
											)} · ${t(`orders.shipping.${order.shippingMethod}`)}`}
										</span>
									</div>
									<div className="grid justify-items-end gap-0.5">
										<span className="font-medium text-sm tabular-nums">
											{money.format(order.total)}
										</span>
										<span
											className="text-muted-foreground text-xs"
											title={dateTime.format(new Date(order.placedAt))}
										>
											{formatRelativeTime(order.placedAt, now, locale)}
										</span>
									</div>
									<div className="@3xl/main:flex hidden justify-end">
										{stage ? <ShelfStageBadge stage={stage} /> : null}
									</div>
								</li>
							);
						})}
					</ul>
				</CardContent>
			)}
		</Card>
	);
}
