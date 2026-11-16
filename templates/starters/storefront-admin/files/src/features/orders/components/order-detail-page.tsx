// The detail page of one order: its header and status, the timeline, the items, the customer, and the delivery.
// The /app/orders/$orderId route renders it after its loader. The route also uses the skeleton below.
// An unknown order number shows a not-found block with a link back to the list.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	dateTimeFormat,
	fillMessage,
	formatRelativeTime,
	OrderStatusBadge,
} from "~/features/shop";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { orderQueryOptions } from "../api/orders.queries";
import { shelfStageOf } from "../lib/order-progress";
import { orderNumberOf } from "../lib/order-text";
import { OrderCustomerCard } from "./order-customer-card";
import { OrderDeliveryCard } from "./order-delivery-card";
import { OrderItemsCard } from "./order-items-card";
import { OrderTimelineCard } from "./order-timeline-card";
import { ShelfStageBadge } from "./shelf-stage-badge";

type OrderDetailPageProps = {
	/** The `$orderId` param of the URL: an order number as text. The query answers null for an unknown one. */
	orderId: string;
};

/** The detail page. A 2/3 main column and a 1/3 side column from the 5xl container width. */
export function OrderDetailPage({ orderId }: OrderDetailPageProps) {
	const { t, locale } = useT();
	const { data: order } = useSuspenseQuery(orderQueryOptions(orderId));

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 min-h-11 justify-self-start sm:min-h-0"
		>
			<Link to="/app/orders">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("orders.title")}
			</Link>
		</Button>
	);
	if (!order) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">{t("orders.notFound")}</p>
			</div>
		);
	}

	const now = Date.now();
	const shelfStage = shelfStageOf(order, now);

	return (
		<div className="grid gap-6">
			{backLink}
			<PageHeader
				title={fillMessage(t("orders.orderTitle"), {
					number: orderNumberOf(order.id),
				})}
				description={
					<span className="flex flex-wrap items-center gap-2">
						{/* To pack, packed, and late all mean "to ship", so the stage replaces the status badge. */}
						{shelfStage ? (
							<ShelfStageBadge stage={shelfStage} />
						) : (
							<OrderStatusBadge status={order.status} />
						)}
						<span>
							{fillMessage(t("orders.placedLine"), {
								date: dateTimeFormat(locale).format(new Date(order.placedAt)),
								relative: formatRelativeTime(order.placedAt, now, locale),
							})}
						</span>
					</span>
				}
			/>
			<div className="grid @5xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid gap-6">
					<OrderTimelineCard order={order} />
					<OrderItemsCard order={order} />
				</div>
				<div className="grid gap-6">
					<OrderCustomerCard order={order} />
					<OrderDeliveryCard order={order} />
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function OrderDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-24" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-5 w-72" />
			</div>
			<div className="grid @5xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid gap-6">
					<Skeleton className="h-40" />
					<Skeleton className="h-80" />
				</div>
				<div className="grid gap-6">
					<Skeleton className="h-64" />
					<Skeleton className="h-56" />
				</div>
			</div>
		</div>
	);
}
