// The detail page of one order, in the anatomy of the kit profile page: a title row, three tabs,
// then a 1/3 side column (customer, progress, tags) and a 2/3 main column (activity, then items and other orders).
// The /app/orders/$orderId route renders it after its loader. The route also uses the skeleton below.
// An unknown order number shows a not-found block with a link back to the list.
import { UserIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	dateTimeFormat,
	fillMessage,
	formatRelativeTime,
	OrderStatusBadge,
	shelfStageOf,
} from "~/features/shop";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { orderQueryOptions } from "../api/orders.queries";
import { orderNumberOf } from "../lib/order-text";
import { OrderCustomerCard } from "./order-customer-card";
import { OrderItemsCard } from "./order-items-card";
import { OrderOtherOrdersCard } from "./order-other-orders-card";
import { OrderProgressCard } from "./order-progress-card";
import { OrderTagsCard } from "./order-tags-card";
import { OrderTimelineCard } from "./order-timeline-card";
import { ShelfStageBadge } from "./shelf-stage-badge";

type OrderDetailPageProps = {
	/** The `$orderId` param of the URL: an order number as text. The query answers null for an unknown one. */
	orderId: string;
};

/** The tabs of the page. Overview holds every card; the two others show one card at full width. */
type DetailTab = "overview" | "items" | "activity";

/** The count of events in the activity card of the Overview tab. The Activity tab shows every step. */
const OVERVIEW_EVENT_COUNT = 3;

/** The detail page. The two columns start at the 4xl container width; a phone shows one column. */
export function OrderDetailPage({ orderId }: OrderDetailPageProps) {
	const { t, locale } = useT();
	const { data: order } = useSuspenseQuery(orderQueryOptions(orderId));
	const [tab, setTab] = useState<DetailTab>("overview");

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
		<div className="grid gap-4">
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
				actions={
					<Button asChild>
						<Link to="/app/customers" search={{ customer: order.customerId }}>
							<UserIcon />
							{t("orders.viewCustomer")}
						</Link>
					</Button>
				}
			/>
			<Tabs
				value={tab}
				onValueChange={(value) =>
					setTab(value === "items" || value === "activity" ? value : "overview")
				}
				className="gap-4"
			>
				<TabsList>
					<TabsTrigger value="overview">
						{t("orders.tabs.overview")}
					</TabsTrigger>
					<TabsTrigger value="items">{t("orders.tabs.items")}</TabsTrigger>
					<TabsTrigger value="activity">
						{t("orders.tabs.activity")}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="overview">
					<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
						<div className="grid gap-4">
							<OrderCustomerCard order={order} />
							<OrderProgressCard order={order} />
							<OrderTagsCard order={order} />
						</div>
						<div className="@4xl/main:col-span-2 grid gap-4">
							<OrderTimelineCard
								order={order}
								limit={OVERVIEW_EVENT_COUNT}
								onViewAll={() => setTab("activity")}
							/>
							{/* The two cards share the row height, as in the kit, so no empty band shows under the shorter one. */}
							<div className="grid @2xl/main:grid-cols-2 gap-4">
								<OrderItemsCard order={order} />
								<OrderOtherOrdersCard order={order} />
							</div>
						</div>
					</div>
				</TabsContent>
				<TabsContent value="items">
					<OrderItemsCard order={order} />
				</TabsContent>
				<TabsContent value="activity">
					<OrderTimelineCard order={order} />
				</TabsContent>
			</Tabs>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function OrderDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-8 w-24" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-5 w-72 max-w-full" />
			</div>
			<Skeleton className="h-9 w-64 max-w-full" />
			<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
				<div className="grid gap-4">
					<Skeleton className="h-112" />
					<Skeleton className="h-28" />
				</div>
				<div className="@4xl/main:col-span-2 grid gap-4">
					<Skeleton className="h-80" />
					<Skeleton className="h-72" />
				</div>
			</div>
		</div>
	);
}
