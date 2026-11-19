// The identity card of one check, in the anatomy of the kit profile card.
// A centered table tile, the table and the status, a box of 3 figures, then a list of facts with icons.
// OrderDetailPage renders it first in the start column of the overview.
import {
	ClockIcon,
	CreditCardIcon,
	ForkKnifeIcon,
	HourglassIcon,
	UserCircleIcon,
} from "@phosphor-icons/react";
import {
	fillMessage,
	formatCents,
	formatClock,
	formatMinutes,
	minutesSince,
	moneyFormat,
	ORDER_STATUS_BADGE,
	type Order,
	orderItemCount,
	orderSubtotalCents,
	orderTotalCents,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent } from "~/shared/ui/card";

type CheckCardProps = {
	order: Order;
	/** Milliseconds since 1970 at render. An open check counts its time at the table to now. */
	now: number;
};

/** The 3 figures are the items, the covers, and the total that the guest pays. */
export function CheckCard({ order, now }: CheckCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	// A paid check ends at the payment, a void at the void, an open check now.
	const end = order.paidAt ?? order.voidedAt;
	const minutesAtTable = minutesSince(
		order.openedAt,
		end ? Date.parse(end) : now,
	);
	const figures = [
		{
			key: "items",
			value: number.format(orderItemCount(order)),
			label: t("orderDetail.items"),
		},
		{
			key: "covers",
			value: number.format(order.covers),
			label: t("orderDetail.covers"),
		},
		{
			key: "total",
			value: formatCents(money, orderTotalCents(order)),
			label: t("orderDetail.total"),
		},
	];
	const facts = [
		{ key: "server", icon: UserCircleIcon, text: order.serverName },
		{
			key: "opened",
			icon: ClockIcon,
			text: fillMessage(t("orderDetail.openedAt"), {
				time: formatClock(order.openedAt, locale),
			}),
		},
		{
			key: "duration",
			icon: HourglassIcon,
			text: fillMessage(t("orderDetail.atTable"), {
				time: formatMinutes(minutesAtTable, locale),
			}),
		},
		{
			key: "perCover",
			icon: ForkKnifeIcon,
			text: fillMessage(t("orderDetail.perCoverValue"), {
				amount: formatCents(
					money,
					Math.round(orderSubtotalCents(order) / order.covers),
				),
			}),
		},
		{
			key: "payment",
			icon: CreditCardIcon,
			text: order.payment
				? t(`payments.${order.payment}`)
				: t("orderDetail.notPaid"),
		},
	];

	return (
		<Card>
			<CardContent className="grid gap-12">
				<div className="grid justify-items-center gap-4">
					<span
						aria-hidden="true"
						className="flex size-20 items-center justify-center rounded-full bg-muted font-display font-semibold text-2xl text-muted-foreground"
					>
						{order.tableName}
					</span>
					<div className="grid justify-items-center gap-1 text-center">
						<p className="flex items-center gap-2 font-semibold text-xl">
							{fillMessage(t("orderDetail.tableTitle"), {
								table: order.tableName,
							})}
							<Badge variant={ORDER_STATUS_BADGE[order.status]}>
								{t(`orderStatuses.${order.status}`)}
							</Badge>
						</p>
						<p className="text-muted-foreground text-sm">
							{t(`zones.${order.zone}`)}
						</p>
					</div>
				</div>
				<dl className="grid grid-cols-3 divide-x rounded-md border bg-muted text-center rtl:divide-x-reverse">
					{figures.map((figure) => (
						<div key={figure.key} className="grid gap-0.5 px-1 py-3">
							<dt className="order-2 text-muted-foreground text-sm">
								{figure.label}
							</dt>
							<dd className="font-numeric font-semibold text-lg tabular-nums">
								{figure.value}
							</dd>
						</div>
					))}
				</dl>
				<ul className="grid gap-4">
					{facts.map((fact) => (
						<li key={fact.key} className="flex items-center gap-3 text-sm">
							<fact.icon className="size-4 shrink-0 text-muted-foreground" />
							{fact.text}
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
