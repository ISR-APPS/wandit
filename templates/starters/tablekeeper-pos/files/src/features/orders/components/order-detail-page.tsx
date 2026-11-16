// The detail page of one check: its header and status, the lines and totals, the facts, the timeline,
// and the other checks of the same table today. The /app/orders/$orderId route renders it after its loader.
// An unknown check number shows a not-found block with a link back to the list.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	fillMessage,
	formatCents,
	formatMinutes,
	minutesSince,
	moneyFormat,
	OPEN_ORDER_STATUSES,
	ORDER_STATUS_BADGE,
	orderItemCount,
	orderQueryOptions,
	orderSubtotalCents,
	ordersQueryOptions,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { Fact } from "./fact";
import { OrderLinesCard } from "./order-lines-card";
import { OrderTimeline } from "./order-timeline";
import { TableChecksList } from "./table-checks-list";

type OrderDetailPageProps = {
	/** The `$orderId` param of the URL: a check number as text. The query returns null for an unknown one. */
	orderId: string;
};

/** A 2/3 main column and a 1/3 rail from the 5xl container width. */
export function OrderDetailPage({ orderId }: OrderDetailPageProps) {
	const { t, locale } = useT();
	const { data: order } = useSuspenseQuery(orderQueryOptions(orderId));
	const { data: orders } = useSuspenseQuery(ordersQueryOptions());
	const money = moneyFormat(locale);
	const now = Date.now();

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start"
		>
			<Link to="/app/orders">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("orderDetail.back")}
			</Link>
		</Button>
	);
	if (!order) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">
					{t("orderDetail.notFound")}
				</p>
			</div>
		);
	}

	const isOpen = OPEN_ORDER_STATUSES.includes(order.status);
	// A paid check ends at the payment, a void at the void, an open check now.
	const end = order.paidAt ?? order.voidedAt;
	const endMs = end ? Date.parse(end) : now;
	const sameTable = orders.filter(
		(other) => other.tableId === order.tableId && other.id !== order.id,
	);

	return (
		<div className="grid gap-6">
			{backLink}
			<PageHeader
				title={fillMessage(t("orderDetail.title"), {
					number: String(order.number),
				})}
				description={
					<span className="flex flex-wrap items-center gap-2">
						<Badge variant={ORDER_STATUS_BADGE[order.status]}>
							{t(`orderStatuses.${order.status}`)}
						</Badge>
						<span>
							{order.tableName} · {t(`zones.${order.zone}`)} ·{" "}
							{order.serverName}
						</span>
					</span>
				}
				actions={
					isOpen ? (
						<Button asChild>
							<Link to="/app/order" search={{ table: order.tableId }}>
								{t("orderDetail.addItems")}
							</Link>
						</Button>
					) : undefined
				}
			/>
			<div className="grid @5xl/main:grid-cols-3 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid gap-6">
					<OrderLinesCard order={order} />
					<Card>
						<CardHeader>
							<CardTitle>{t("orderDetail.sameTable")}</CardTitle>
						</CardHeader>
						<CardContent>
							<TableChecksList
								orders={sameTable}
								emptyText={t("orderDetail.sameTableEmpty")}
							/>
						</CardContent>
					</Card>
				</div>
				<div className="grid gap-6">
					<Card>
						<CardHeader>
							<CardTitle>{t("orderDetail.details")}</CardTitle>
						</CardHeader>
						<CardContent>
							<dl className="grid grid-cols-2 gap-4 text-sm">
								<Fact label={t("orderDetail.items")}>
									<span className="tabular-nums">{orderItemCount(order)}</span>
								</Fact>
								<Fact label={t("orderDetail.covers")}>
									<span className="tabular-nums">{order.covers}</span>
								</Fact>
								<Fact label={t("orderDetail.perCover")}>
									<span className="tabular-nums">
										{formatCents(
											money,
											Math.round(orderSubtotalCents(order) / order.covers),
										)}
									</span>
								</Fact>
								<Fact label={t("orderDetail.duration")}>
									<span className="tabular-nums">
										{formatMinutes(minutesSince(order.openedAt, endMs), locale)}
									</span>
								</Fact>
								<Fact label={t("orderDetail.timeToServe")}>
									{order.servedAt ? (
										<span className="tabular-nums">
											{formatMinutes(
												minutesSince(order.sentAt, Date.parse(order.servedAt)),
												locale,
											)}
										</span>
									) : (
										t("orderDetail.notServed")
									)}
								</Fact>
								<Fact label={t("orderDetail.payment")}>
									{order.payment
										? t(`payments.${order.payment}`)
										: t("orderDetail.notPaid")}
								</Fact>
							</dl>
						</CardContent>
					</Card>
					<OrderTimeline order={order} now={now} />
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function OrderDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-28" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-5 w-64" />
			</div>
			<div className="grid @5xl/main:grid-cols-3 items-start gap-6">
				<Skeleton className="@5xl/main:col-span-2 h-96" />
				<Skeleton className="h-72" />
			</div>
		</div>
	);
}
