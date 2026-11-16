// The order list behind login: the page header, the status tabs, the delivery filter, and the searchable table.
// The /app/orders route renders it after its loader. The route also uses the skeleton and the error below.
// The status tab lives in the URL (?status=), so the home can link to the orders to ship.
import { LightningIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	CustomerAvatar,
	countsAsRevenue,
	dateTimeFormat,
	moneyFormat,
	ORDER_STATUSES,
	OrderStatusBadge,
	SHIPPING_METHODS,
	type ShippingMethod,
} from "~/features/shop";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { type Order, ordersQueryOptions } from "../api/orders.queries";
import { shelfStageOf, shipByOf } from "../lib/order-progress";
import { itemsSummaryOf, orderNumberOf } from "../lib/order-text";
import { ShelfStageBadge } from "./shelf-stage-badge";

const routeApi = getRouteApi("/app/orders/");

/** The list page. The tab and the delivery filter cut the rows; then DataTable searches, sorts, and pages them. */
export function OrdersPage() {
	const { t, locale } = useT();
	const { data: orders } = useSuspenseQuery(ordersQueryOptions());
	const { status } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	const [shipping, setShipping] = useState<ShippingMethod | "all">("all");

	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const dateTime = dateTimeFormat(locale);
	const now = Date.now();
	// The delivery filter comes first, so each tab count is the count of the rows that its tab shows.
	const byShipping =
		shipping === "all"
			? orders
			: orders.filter((order) => order.shippingMethod === shipping);
	// A tab shows only for a status that has rows.
	const tabs = ORDER_STATUSES.map((value) => ({
		value,
		count: byShipping.filter((order) => order.status === value).length,
	})).filter((tab) => tab.count > 0);
	// A status of the URL with no row has no tab, so the list shows all rows.
	const activeStatus = tabs.some((tab) => tab.value === status)
		? (status ?? "all")
		: "all";
	const statusRows =
		activeStatus === "all"
			? byShipping
			: byShipping.filter((order) => order.status === activeStatus);
	// The orders to ship come in the order of the home list: the one that must leave first is on top.
	const rows =
		activeStatus === "to_ship"
			? [...statusRows].sort(
					(first, second) => shipByOf(first) - shipByOf(second),
				)
			: statusRows;

	const columns: DataTableColumn<Order>[] = [
		{
			id: "order",
			header: t("orders.order"),
			sortValue: (row) => Number(row.id),
			cell: (row) => (
				// On a phone the card edge falls on the end of the Total column, so no name is cut in the middle.
				// 15.125rem is the card padding and border, three cell paddings, and the next two cells (w-20 each).
				// On a wide screen the summary stops at 18rem.
				<div className="grid @5xl/main:w-auto @md/main:w-36 w-[calc(100cqw-15.125rem)] @5xl/main:max-w-72 gap-0.5">
					<span className="flex items-center gap-1.5">
						<Link
							to="/app/orders/$orderId"
							params={{ orderId: row.id }}
							// On a phone the link gets a touch area of 44 px with no change of the row height.
							className="relative font-medium tabular-nums hover:underline max-sm:before:absolute max-sm:before:-inset-3"
						>
							{orderNumberOf(row.id)}
						</Link>
						{row.shippingMethod === "express" ? (
							<LightningIcon
								role="img"
								aria-hidden={false}
								aria-label={t("orders.shipping.express")}
								className="size-3.5 text-warning"
							/>
						) : null}
					</span>
					<span className="truncate text-muted-foreground text-xs">
						{itemsSummaryOf(row, t("orders.itemsMore"), number)}
					</span>
				</div>
			),
		},
		{
			id: "status",
			header: t("orders.status"),
			sortValue: (row) => ORDER_STATUSES.indexOf(row.status),
			cell: (row) => {
				// To pack, packed, and late all mean "to ship", so the stage replaces the status badge.
				const stage = shelfStageOf(row, now);
				return (
					<div className="@md/main:w-auto w-20">
						{stage ? (
							<ShelfStageBadge stage={stage} />
						) : (
							<OrderStatusBadge status={row.status} />
						)}
					</div>
				);
			},
		},
		{
			id: "total",
			header: t("orders.total"),
			align: "end",
			sortValue: (row) => row.total,
			cell: (row) => (
				// A cancelled or refunded order brought no money, so its amount is struck through.
				<div
					className={cn(
						"@md/main:w-auto w-20",
						!countsAsRevenue(row.status) &&
							"text-muted-foreground line-through",
					)}
				>
					{money.format(row.total)}
				</div>
			),
		},
		{
			id: "customer",
			header: t("orders.customer"),
			sortValue: (row) => row.customerName,
			cell: (row) => (
				// A wide minimum: the table gives its free width by content width, so the customer takes most of it.
				// Then the status stays near its order on a wide screen.
				<div className="flex @5xl/main:min-w-80 items-center gap-2.5">
					<CustomerAvatar
						name={row.customerName}
						className="@3xl/main:flex hidden"
					/>
					<div className="grid justify-items-start">
						<span dir="auto">{row.customerName}</span>
						<span className="text-muted-foreground text-xs" dir="auto">
							{row.customerPlace}
						</span>
					</div>
				</div>
			),
		},
		{
			id: "placed",
			header: t("orders.placed"),
			sortValue: (row) => Date.parse(row.placedAt),
			cell: (row) => (
				<span className="tabular-nums">
					{dateTime.format(new Date(row.placedAt))}
				</span>
			),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("orders.title")}
				description={t("orders.description")}
			/>
			{orders.length === 0 ? (
				<Card>
					<CardContent className="py-10 text-center text-muted-foreground text-sm">
						{t("orders.empty")}
					</CardContent>
				</Card>
			) : (
				<Card>
					{/* A narrower padding on a phone gives the table room for its first three columns. */}
					<CardContent className="@md/main:px-6 px-4">
						<DataTable
							rows={rows}
							columns={columns}
							searchText={(row) =>
								`${orderNumberOf(row.id)} ${row.id} ${row.customerName} ${row.customerPlace} ${row.firstProductName}`
							}
							noResults={t("orders.noResults")}
							toolbar={
								<>
									<Tabs
										value={activeStatus}
										onValueChange={(value) =>
											navigate({
												search: {
													status: ORDER_STATUSES.find(
														(option) => option === value,
													),
												},
												replace: true,
											})
										}
										// On a narrow card the tabs take their own line under the search and the filter.
										className="@5xl/main:order-none order-last max-w-full @5xl/main:basis-auto basis-full"
									>
										{/* On a narrow card the tabs wrap to a second line, so no tab label is cut. */}
										<TabsList className="flex-wrap group-data-[orientation=horizontal]/tabs:h-auto">
											<TabsTrigger value="all">
												{t("orders.all")}
												<span className="text-muted-foreground tabular-nums">
													{number.format(byShipping.length)}
												</span>
											</TabsTrigger>
											{tabs.map((tab) => (
												<TabsTrigger key={tab.value} value={tab.value}>
													{t(`orders.statuses.${tab.value}`)}
													<span className="text-muted-foreground tabular-nums">
														{number.format(tab.count)}
													</span>
												</TabsTrigger>
											))}
										</TabsList>
									</Tabs>
									<Select
										value={shipping}
										onValueChange={(value) =>
											setShipping(
												SHIPPING_METHODS.find((option) => option === value) ??
													"all",
											)
										}
									>
										<SelectTrigger
											aria-label={t("orders.delivery")}
											className="w-40 max-sm:w-full sm:ms-auto"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent align="end">
											<SelectItem value="all">
												{t("orders.allDeliveries")}
											</SelectItem>
											{SHIPPING_METHODS.map((method) => (
												<SelectItem key={method} value={method}>
													{t(`orders.shipping.${method}`)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</>
							}
						/>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function OrdersPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-64" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-xs" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the order pages when a loader fails. Try again runs the loader again. */
export function OrdersPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("orders.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
