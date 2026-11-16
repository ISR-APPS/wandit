// The page of one item: its level, its picks per day, its movements, its record, its level history, and its orders.
// The /app/items/$itemId route renders it after its loader. The route also uses the skeleton below.
// An unknown id shows a not-found block with a link back to the list.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { isOpenOrderStatus, StockStatusBadge } from "~/features/stock";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { itemQueryOptions } from "../api/items.queries";
import { ItemDetailsCard } from "./item-details-card";
import { ItemLevelCard } from "./item-level-card";
import { ItemMovementsCard } from "./item-movements-card";
import { ItemOrdersCard } from "./item-orders-card";
import { ItemPicksCard } from "./item-picks-card";
import { ItemStockCard } from "./item-stock-card";

type ItemDetailPageProps = {
	/** The `$itemId` param of the URL: the lower case SKU. The query answers null for an unknown id. */
	itemId: string;
};

/** A 2/3 main column and a 1/3 rail from the 4xl container width (56rem), so a 1280 px laptop gets both. */
export function ItemDetailPage({ itemId }: ItemDetailPageProps) {
	const { t } = useT();
	const { data: detail } = useSuspenseQuery(itemQueryOptions(itemId));

	const backLink = (
		<Button
			asChild
			variant="ghost"
			className="-ms-3 min-h-11 justify-self-start"
		>
			<Link to="/app/items">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("items.title")}
			</Link>
		</Button>
	);
	if (!detail) {
		return (
			<div className="grid gap-4">
				{backLink}
				<Card>
					<CardContent>
						<p className="text-muted-foreground text-sm">
							{t("itemDetail.notFound")}
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	const { item, supplier, movements, orders, levels } = detail;
	// The order that brings the next goods: the oldest open order of the item.
	const openOrder = orders
		.filter((order) => isOpenOrderStatus(order.status))
		.at(-1);

	return (
		<div className="grid gap-6">
			{/* gap-1: the back link has a 44 px touch area, so it needs no more space above the title. */}
			<div className="grid gap-1">
				{backLink}
				<PageHeader
					title={item.name}
					description={
						<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
							<StockStatusBadge status={item.status} />
							<span className="font-numeric">{item.sku}</span>
							<span>
								{t("itemDetail.binPrefix")}{" "}
								<span className="font-numeric">{item.bin}</span>
							</span>
						</span>
					}
					actions={
						openOrder ? (
							<Button asChild variant="outline">
								<Link
									to="/app/purchase-orders"
									search={{ po: openOrder.orderId }}
								>
									{`${t("itemDetail.openOrder")} ${openOrder.number}`}
								</Link>
							</Button>
						) : null
					}
				/>
			</div>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<div className="@4xl/main:col-span-2 grid min-w-0 gap-6">
					<ItemStockCard item={item} />
					<ItemPicksCard itemId={item.id} />
					<ItemMovementsCard movements={movements} />
				</div>
				<div className="grid min-w-0 gap-6">
					<ItemDetailsCard item={item} supplier={supplier} />
					<ItemLevelCard
						levels={levels}
						minimum={item.minimum}
						unit={item.unit}
					/>
					<ItemOrdersCard orders={orders} unit={item.unit} />
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the item loader runs. The route sets it as pendingComponent. */
export function ItemDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-24" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-72" />
				<Skeleton className="h-5 w-56" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<div className="@4xl/main:col-span-2 grid gap-6">
					<Skeleton className="h-44" />
					<Skeleton className="h-80" />
				</div>
				<div className="grid gap-6">
					<Skeleton className="h-64" />
					<Skeleton className="h-72" />
					<Skeleton className="h-56" />
				</div>
			</div>
		</div>
	);
}
