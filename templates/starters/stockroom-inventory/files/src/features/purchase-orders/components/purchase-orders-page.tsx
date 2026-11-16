// The purchase order list behind login: the status and late tabs, the supplier filter, the table, and the order panel.
// The /app/purchase-orders route renders it after its loader. The route also uses the skeleton and the error below.
// The tab, the supplier, and the open order live in the URL (purchase-orders-search.ts).
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	formatRelativeDay,
	isOpenOrderStatus,
	LoadError,
	moneyFormat,
	OrderStatusBadge,
	PURCHASE_ORDER_STATUSES,
} from "~/features/stock";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
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
import {
	type PurchaseOrder,
	purchaseOrdersQueryOptions,
} from "../api/purchase-orders.queries";
import { PurchaseOrderSheet } from "./purchase-order-sheet";

/** The list page. The supplier filter applies first, then the status tab; DataTable then searches, sorts, and pages. */
export function PurchaseOrdersPage() {
	const { t, locale } = useT();
	const { data: orders } = useSuspenseQuery(purchaseOrdersQueryOptions());
	const search = useSearch({ from: "/app/purchase-orders" });
	const navigate = useNavigate({ from: "/app/purchase-orders" });

	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const money = moneyFormat(locale, true);
	const date = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const now = Date.now();

	// The supplier Select lists only suppliers with orders, by name.
	const suppliers = [
		...new Map(orders.map((order) => [order.supplierId, order.supplierName])),
	].sort((first, second) => first[1].localeCompare(second[1], locale));
	const supplierId = suppliers.some(([id]) => id === search.supplier)
		? search.supplier
		: undefined;
	const ofSupplier = supplierId
		? orders.filter((order) => order.supplierId === supplierId)
		: orders;
	// A tab shows only for a status that has rows for the chosen supplier.
	const tabs = PURCHASE_ORDER_STATUSES.map((status) => ({
		status,
		count: ofSupplier.filter((order) => order.status === status).length,
	})).filter((tab) => tab.count > 0);
	// The Late tab crosses the status tabs: a late order is "ordered" or "partly received".
	const lateCount = ofSupplier.filter((order) => order.lateDays > 0).length;
	const isLateTab = search.late === true && lateCount > 0;
	const activeStatus =
		!isLateTab && tabs.some((tab) => tab.status === search.status)
			? search.status
			: undefined;
	const rows = isLateTab
		? ofSupplier.filter((order) => order.lateDays > 0)
		: activeStatus
			? ofSupplier.filter((order) => order.status === activeStatus)
			: ofSupplier;
	const openOrders = orders.filter((order) => isOpenOrderStatus(order.status));
	const openValue = openOrders.reduce(
		(sum, order) =>
			sum +
			order.lines.reduce(
				(lineSum, line) =>
					lineSum +
					(line.quantityOrdered - line.quantityReceived) * line.unitCost,
				0,
			),
		0,
	);
	const selectedOrder = orders.find((order) => order.id === search.po) ?? null;

	// Expected and total come right after the order: a phone shows these three columns before the table scrolls.
	// Status comes last: a phone shows it in the order cell, so the edge of the scroll never cuts a badge.
	const columns: DataTableColumn<PurchaseOrder>[] = [
		{
			id: "order",
			header: t("purchaseOrders.order"),
			sortValue: (order) => order.number,
			cell: (order) => (
				// after:-inset-2 stretches the link over the cell padding, for a 44 px touch target.
				<div className="relative grid justify-items-start gap-0.5">
					<Link
						from="/app/purchase-orders"
						search={(previous) => ({ ...previous, po: order.id })}
						className="font-medium font-numeric after:absolute after:-inset-2 hover:underline"
					>
						{order.number}
					</Link>
					<span className="text-muted-foreground text-xs" dir="auto">
						{order.supplierName}
					</span>
					{/* Under 32rem the Status column is past the scroll, so the status shows here. */}
					<span className="@lg/main:hidden pt-1">
						<OrderStatusBadge status={order.status} lateDays={order.lateDays} />
					</span>
				</div>
			),
		},
		{
			id: "expected",
			header: t("purchaseOrders.expected"),
			sortValue: (order) => Date.parse(order.expectedOn),
			cell: (order) =>
				isOpenOrderStatus(order.status) ? (
					<span
						className={cn(order.lateDays > 0 && "font-medium text-destructive")}
					>
						{formatRelativeDay(order.expectedOn, now, locale)}
					</span>
				) : (
					<span className="text-muted-foreground">
						{date.format(new Date(order.expectedOn))}
					</span>
				),
		},
		{
			id: "total",
			header: t("purchaseOrders.total"),
			align: "end",
			sortValue: (order) => order.total,
			cell: (order) => (
				<span
					className={cn(
						order.status === "cancelled" &&
							"text-muted-foreground line-through",
					)}
				>
					{money.format(order.total)}
				</span>
			),
		},
		{
			id: "created",
			header: t("purchaseOrders.created"),
			sortValue: (order) => Date.parse(order.createdAt),
			cell: (order) => date.format(new Date(order.createdAt)),
		},
		{
			id: "lines",
			header: t("purchaseOrders.linesCount"),
			align: "end",
			sortValue: (order) => order.lines.length,
			cell: (order) => number.format(order.lines.length),
		},
		{
			id: "received",
			header: t("purchaseOrders.received"),
			align: "end",
			sortValue: (order) =>
				order.unitsReceived / Math.max(1, order.unitsOrdered),
			cell: (order) =>
				order.status === "draft" || order.status === "cancelled" ? (
					<span className="text-muted-foreground">{t("items.none")}</span>
				) : (
					percent.format(order.unitsReceived / Math.max(1, order.unitsOrdered))
				),
		},
		{
			id: "status",
			header: t("purchaseOrders.status"),
			sortValue: (order) => PURCHASE_ORDER_STATUSES.indexOf(order.status),
			cell: (order) => (
				<OrderStatusBadge status={order.status} lateDays={order.lateDays} />
			),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("purchaseOrders.title")}
				description={`${number.format(openOrders.length)} ${t("purchaseOrders.openLabel")} · ${money.format(openValue)} ${t("purchaseOrders.onOrderLabel")}`}
			/>
			<Card>
				<CardContent>
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(order) =>
							`${order.number} ${order.supplierName} ${order.lines.map((line) => `${line.itemName} ${line.sku}`).join(" ")}`
						}
						noResults={t("purchaseOrders.noResults")}
						toolbar={
							<>
								<Tabs
									value={isLateTab ? "late" : (activeStatus ?? "all")}
									onValueChange={(value) =>
										navigate({
											search: (previous) => ({
												...previous,
												late: value === "late" ? true : undefined,
												status: PURCHASE_ORDER_STATUSES.find(
													(status) => status === value,
												),
											}),
											replace: true,
										})
									}
									className="max-w-full"
								>
									{/* The tabs wrap to a second row on a phone, so no tab hides past the edge. */}
									<TabsList className="flex-wrap justify-start group-data-[orientation=horizontal]/tabs:h-auto">
										<TabsTrigger value="all" className="h-9 flex-none">
											{t("purchaseOrders.all")}
											<span className="text-muted-foreground tabular-nums">
												{number.format(ofSupplier.length)}
											</span>
										</TabsTrigger>
										{lateCount > 0 ? (
											<TabsTrigger value="late" className="h-9 flex-none">
												{t("purchaseOrders.late")}
												<span className="text-muted-foreground tabular-nums">
													{number.format(lateCount)}
												</span>
											</TabsTrigger>
										) : null}
										{tabs.map((tab) => (
											<TabsTrigger
												key={tab.status}
												value={tab.status}
												className="h-9 flex-none"
											>
												{t(`orderStatuses.${tab.status}`)}
												<span className="text-muted-foreground tabular-nums">
													{number.format(tab.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
								<Select
									value={supplierId ?? "all"}
									onValueChange={(value) =>
										navigate({
											search: (previous) => ({
												...previous,
												supplier: value === "all" ? undefined : value,
											}),
											replace: true,
										})
									}
								>
									<SelectTrigger
										aria-label={t("purchaseOrders.supplier")}
										className="w-full sm:w-56"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">
											{t("purchaseOrders.allSuppliers")}
										</SelectItem>
										{suppliers.map(([id, name]) => (
											<SelectItem key={id} value={id}>
												{name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</>
						}
					/>
				</CardContent>
			</Card>
			<PurchaseOrderSheet
				order={selectedOrder}
				onClose={() =>
					navigate({
						search: (previous) => ({ ...previous, po: undefined }),
						replace: true,
					})
				}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function PurchaseOrdersPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-4 w-64" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<div className="flex flex-wrap gap-2">
						<Skeleton className="h-9 w-full sm:max-w-xs" />
						<Skeleton className="h-9 w-96 max-w-full" />
					</div>
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the order list when its loader fails. */
export function PurchaseOrdersPageError() {
	const { t } = useT();
	return <LoadError message={t("purchaseOrders.loadError")} />;
}
