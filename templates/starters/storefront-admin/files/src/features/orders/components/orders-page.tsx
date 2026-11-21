// The order list behind login, in the anatomy of the kit order list: the title and the export, the status tabs,
// then the table with a search, the Stage and Category filters, a column menu, row checkboxes, and pages.
// The /app/orders route renders it after its loader. The route also uses the skeleton and the error below.
// The status tab lives in the URL (?status=), so the home can link to one status.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	copyToClipboard,
	downloadCsv,
	moneyFormat,
	ORDER_STATUSES,
	OrderStatusBadge,
	PRODUCT_CATEGORIES,
	ProductTile,
	type ShelfStage,
	shelfStageOf,
	shipByOf,
	toCsv,
} from "~/features/shop";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
} from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { type Order, ordersQueryOptions } from "../api/orders.queries";
import { orderCsvColumns } from "../lib/order-csv";
import { itemsSummaryOf, orderNumberOf } from "../lib/order-text";
import { ShelfStageBadge } from "./shelf-stage-badge";

const routeApi = getRouteApi("/app/orders/");

/** The stage values of the Stage filter, in the order of the work. */
const SHELF_STAGES: ShelfStage[] = ["to_pack", "packed", "late"];

/** The list page. The tab and the two filters cut the rows; then RecordTable searches, sorts, and pages them. */
export function OrdersPage() {
	const { t, locale } = useT();
	const { data: orders } = useSuspenseQuery(ordersQueryOptions());
	const { status } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	const [stage, setStage] = useState<string | null>(null);
	const [category, setCategory] = useState<string | null>(null);

	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const now = Date.now();
	const activeStatus = status ?? "all";
	const statusRows =
		activeStatus === "all"
			? orders
			: orders.filter((order) => order.status === activeStatus);
	// The Stage filter uses the late rule of the header bell, so "Late" lists the orders that the bell counts.
	const filtered = statusRows.filter(
		(order) =>
			(stage === null || shelfStageOf(order, now) === stage) &&
			(category === null ||
				order.categories.some((value) => value === category)),
	);
	// The orders to ship come first by ship-by time: the order that must leave first is on top.
	const rows =
		activeStatus === "to_ship" || stage !== null
			? [...filtered].sort(
					(first, second) => shipByOf(first) - shipByOf(second),
				)
			: filtered;

	const columns: RecordColumn<Order>[] = [
		{
			id: "id",
			header: t("orders.id"),
			sortValue: (order) => Number(order.id),
			cell: (order) => (
				<Link
					to="/app/orders/$orderId"
					params={{ orderId: order.id }}
					className="text-muted-foreground tabular-nums hover:text-foreground hover:underline"
				>
					{orderNumberOf(order.id)}
				</Link>
			),
		},
		{
			id: "product",
			header: t("orders.product"),
			cell: (order) => (
				<div className="flex items-center gap-4">
					{order.categories[0] ? (
						<ProductTile
							category={order.categories[0]}
							className="size-10 lg:size-12"
						/>
					) : null}
					<span className="max-w-56 truncate">
						{itemsSummaryOf(order, t("orders.itemsMore"), number)}
					</span>
				</div>
			),
		},
		{
			id: "total",
			header: t("orders.total"),
			sortValue: (order) => order.total,
			cell: (order) => (
				<span className="tabular-nums">{money.format(order.total)}</span>
			),
		},
		{
			id: "customer",
			header: t("orders.customer"),
			hideable: true,
			cell: (order) => (
				<div className="grid gap-1">
					<span className="font-semibold" dir="auto">
						{order.customerName}
					</span>
					<span className="text-muted-foreground">{order.customerEmail}</span>
				</div>
			),
		},
		{
			id: "date",
			header: t("orders.date"),
			hideable: true,
			sortValue: (order) => Date.parse(order.placedAt),
			cell: (order) => (
				<span className="whitespace-nowrap">
					{date.format(new Date(order.placedAt))}
				</span>
			),
		},
		{
			id: "delivery",
			header: t("orders.delivery"),
			hideable: true,
			cell: (order) => t(`orders.shipping.${order.shippingMethod}`),
		},
		{
			id: "status",
			header: t("orders.status"),
			hideable: true,
			sortValue: (order) => ORDER_STATUSES.indexOf(order.status),
			cell: (order) => {
				const shelfStage = shelfStageOf(order, now);
				// A late order shows "Late" beside "To ship": the team must ship it first.
				return (
					<div className="flex items-center gap-1">
						<OrderStatusBadge status={order.status} />
						{shelfStage === "late" ? (
							<ShelfStageBadge stage={shelfStage} />
						) : null}
					</div>
				);
			},
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("orders.title")}
				actions={
					<Button
						type="button"
						disabled={rows.length === 0}
						onClick={() =>
							downloadCsv("orders.csv", toCsv(rows, orderCsvColumns(t, locale)))
						}
					>
						<DownloadSimpleIcon />
						{t("common.exportCsv")}
					</Button>
				}
			/>
			<Tabs
				value={activeStatus}
				onValueChange={(value) =>
					navigate({
						search: {
							status: ORDER_STATUSES.find((option) => option === value),
						},
						replace: true,
					})
				}
				className="max-w-full"
			>
				{/* On a narrow page the tabs wrap to a second line, so no tab label is cut. */}
				<TabsList className="flex-wrap group-data-[orientation=horizontal]/tabs:h-auto">
					<TabsTrigger value="all">{t("orders.all")}</TabsTrigger>
					{ORDER_STATUSES.map((value) => (
						<TabsTrigger key={value} value={value}>
							{t(`orders.statuses.${value}`)}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			{orders.length === 0 ? (
				<p className="rounded-md border p-10 text-center text-muted-foreground text-sm">
					{t("orders.empty")}
				</p>
			) : (
				<RecordTable
					rows={rows}
					columns={columns}
					searchText={(order) =>
						`${order.id} ${order.customerName} ${order.customerEmail} ${order.firstProductName}`
					}
					searchPlaceholder={t("orders.search")}
					selectable
					pageSize={10}
					noResults={t("orders.noResults")}
					toolbar={
						<>
							<RecordFilter
								label={t("orders.stage")}
								options={SHELF_STAGES.map((value) => ({
									value,
									label: t(`orders.stages.${value}`),
								}))}
								value={stage}
								onValueChange={setStage}
							/>
							<RecordFilter
								label={t("products.category")}
								options={PRODUCT_CATEGORIES.map((value) => ({
									value,
									label: t(`products.categories.${value}`),
								}))}
								value={category}
								onValueChange={setCategory}
							/>
						</>
					}
					bulkActions={(selected) => (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-9"
							onClick={() =>
								downloadCsv(
									"orders-selected.csv",
									toCsv(selected, orderCsvColumns(t, locale)),
								)
							}
						>
							<DownloadSimpleIcon />
							{t("table.exportSelected")}
						</Button>
					)}
					rowMenu={(order) => (
						<>
							<DropdownMenuLabel>{t("table.actions")}</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link to="/app/orders/$orderId" params={{ orderId: order.id }}>
									{t("orders.open")}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link
									to="/app/customers"
									search={{ customer: order.customerId }}
								>
									{t("orders.viewCustomer")}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() =>
									copyToClipboard(orderNumberOf(order.id), {
										done: t("table.copied"),
										failed: t("table.copyFailed"),
									})
								}
							>
								{t("orders.copyNumber")}
							</DropdownMenuItem>
						</>
					)}
				/>
			)}
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the order loader runs. The route sets it as pendingComponent. */
export function OrdersPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-3">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-96 max-w-full" />
			<Skeleton className="h-9 w-full sm:max-w-sm" />
			<div className="grid gap-2">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-14 w-full" />
				))}
			</div>
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
