// The latest orders card of the rep page: a line timeline of the 3 newest orders of the quarter.
// RepDetailPage renders it at the top of the end column. "View all" switches the page to the Orders tab.
// The newest order has a "Latest" badge and a "View order" button that opens the order dialog.
import { ClockIcon, ReceiptIcon } from "@phosphor-icons/react";
import {
	fillMessage,
	moneyFormat,
	type Order,
	OrderStatusBadge,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

// 3 steps keep the timeline short. "View all" opens the full list.
const SHOWN_ORDERS = 3;

type RepLatestOrdersCardProps = {
	/** The orders of the quarter, newest first. */
	orders: Order[];
	/** Opens the order dialog of the page. */
	onOpenOrder: (order: Order) => void;
	/** Switches the page to the Orders tab. */
	onViewAll: () => void;
};

/** Each step: the account, the booking time, then the lines and the amount. No order shows one sentence. */
export function RepLatestOrdersCard({
	orders,
	onOpenOrder,
	onViewAll,
}: RepLatestOrdersCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "long",
		timeStyle: "short",
	});
	const latest = orders.slice(0, SHOWN_ORDERS);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("reps.latestTitle")}</CardTitle>
				<CardAction>
					<button
						type="button"
						className="text-muted-foreground text-sm hover:text-primary hover:underline"
						onClick={onViewAll}
					>
						{t("reps.viewAll")}
					</button>
				</CardAction>
			</CardHeader>
			<CardContent className="ps-8">
				{latest.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("reps.ordersEmpty")}
					</p>
				) : (
					<ol className="relative grid gap-10 border-s">
						{latest.map((order, index) => (
							<li key={order.id} className="ms-6 grid gap-2">
								<span
									aria-hidden="true"
									className="absolute -start-3 flex size-6 items-center justify-center rounded-full border bg-muted"
								>
									<ReceiptIcon className="size-3 text-primary" />
								</span>
								<p className="flex flex-wrap items-center gap-2 font-semibold">
									<bdi>{order.accountName}</bdi>
									{index === 0 ? (
										<Badge variant="outline">{t("reps.latest")}</Badge>
									) : null}
									<OrderStatusBadge status={order.status} />
								</p>
								<p className="flex items-center gap-1.5 text-muted-foreground text-sm leading-none">
									<ClockIcon className="size-3" />
									<time dateTime={order.bookedAt}>
										{fillMessage(t("reps.bookedOn"), {
											number: order.number,
											date: dateTime.format(new Date(order.bookedAt)),
										})}
									</time>
								</p>
								<p className="text-muted-foreground text-sm">
									{order.lines
										.map(
											(line) =>
												`${number.format(line.quantity)} × ${t(`productLines.${line.productLine}`)}`,
										)
										.join(", ")}
									{` · ${money.format(order.amount)}`}
								</p>
								{index === 0 ? (
									<Button
										type="button"
										variant="outline"
										className="justify-self-start"
										onClick={() => onOpenOrder(order)}
									>
										<ReceiptIcon />
										{t("reps.viewOrder")}
									</Button>
								) : null}
							</li>
						))}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}
