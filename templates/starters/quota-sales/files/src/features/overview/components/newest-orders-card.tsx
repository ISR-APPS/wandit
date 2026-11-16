// The newest orders of the home: the first 6 rows of the orders list, with a "See all" link.
// OverviewPage passes the rows. A click on an account opens OrderDialog with the lines of the order.
// On a narrow page the first cell also shows the amount, the status, and the booking time.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { OrderDialog } from "~/features/orders";
import {
	fillMessage,
	formatRelativeTime,
	moneyFormat,
	NARROW_ONLY,
	type Order,
	OrderStatusBadge,
	RepAvatar,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

// The columns after the first one show from the 2xl main width. Below it, the first cell shows their values.
const WIDE_CELL = "hidden @2xl/main:table-cell";

type NewestOrdersCardProps = {
	/** The newest orders, newest first. The card shows them all. */
	orders: Order[];
};

/** A full-width table. The amount and the booking time sit at the end. */
export function NewestOrdersCard({ orders }: NewestOrdersCardProps) {
	const { t, locale } = useT();
	const [openOrder, setOpenOrder] = useState<Order | null>(null);
	const money = moneyFormat(locale);
	const now = Date.now();
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.newestTitle")}</CardTitle>
				{/* flex makes the button a flex item, so -my-2 centers the 32 px button on the 16 px title line. */}
				<CardAction className="flex">
					<Button asChild variant="ghost" size="sm" className="-my-2">
						<Link to="/app/orders">{t("overview.seeAll")}</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{orders.length === 0 ? (
					<p className="py-6 text-center text-muted-foreground text-sm">
						{t("chart.empty")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("orders.account")}</TableHead>
								<TableHead className={WIDE_CELL}>{t("orders.rep")}</TableHead>
								<TableHead className={WIDE_CELL}>
									{t("orders.status")}
								</TableHead>
								<TableHead className={cn("text-end", WIDE_CELL)}>
									{t("orders.amount")}
								</TableHead>
								<TableHead className={cn("text-end", WIDE_CELL)}>
									{t("orders.booked")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{orders.map((order) => {
								const bookedAt = `${formatRelativeTime(order.bookedAt, now, locale)}, ${time.format(new Date(order.bookedAt))}`;
								return (
									<TableRow key={order.id}>
										<TableCell>
											<div className="flex items-start justify-between gap-3">
												<div className="grid min-w-0 justify-items-start">
													<button
														type="button"
														onClick={() => setOpenOrder(order)}
														className="text-start font-medium hover:underline"
														aria-label={fillMessage(t("orders.openOrder"), {
															number: order.number,
														})}
													>
														<bdi>{order.accountName}</bdi>
													</button>
													<span className="text-muted-foreground text-xs tabular-nums">
														{order.number}
														<span
															className={NARROW_ONLY}
														>{` · ${bookedAt}`}</span>
													</span>
												</div>
												<div
													className={cn(
														"grid shrink-0 justify-items-end gap-1",
														NARROW_ONLY,
													)}
												>
													<span className="font-medium tabular-nums">
														{money.format(order.amount)}
													</span>
													<OrderStatusBadge status={order.status} />
												</div>
											</div>
										</TableCell>
										<TableCell className={WIDE_CELL}>
											<span className="flex items-center gap-2">
												<RepAvatar name={order.repName} className="size-6" />
												<bdi className="whitespace-nowrap">{order.repName}</bdi>
											</span>
										</TableCell>
										<TableCell className={WIDE_CELL}>
											<OrderStatusBadge status={order.status} />
										</TableCell>
										<TableCell
											className={cn(
												"text-end font-medium tabular-nums",
												WIDE_CELL,
											)}
										>
											{money.format(order.amount)}
										</TableCell>
										<TableCell
											className={cn(
												"whitespace-nowrap text-end text-muted-foreground",
												WIDE_CELL,
											)}
										>
											{bookedAt}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				)}
			</CardContent>
			<OrderDialog order={openOrder} onClose={() => setOpenOrder(null)} />
		</Card>
	);
}
