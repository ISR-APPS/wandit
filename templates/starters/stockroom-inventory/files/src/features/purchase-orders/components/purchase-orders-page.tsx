// The purchase order list behind login, in the anatomy of the kit order list: the title row, the status tabs,
// a toolbar (search, Supplier and Delivery filters, Columns), and a table with checkboxes, a row menu, and pages.
// The /app/purchase-orders route renders it after its loader. The route also uses the skeleton and the error below.
// The tab, the filters, and the open order panel live in the URL (purchase-orders-search.ts).
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	copyToClipboard,
	downloadCsv,
	fillMessage,
	InitialsTile,
	LoadError,
	moneyFormat,
	OrderStatusBadge,
	PURCHASE_ORDER_STATUSES,
	toCsv,
} from "~/features/stock";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	type PurchaseOrder,
	purchaseOrdersQueryOptions,
} from "../api/purchase-orders.queries";
import { orderCsvColumns } from "../lib/order-csv";
import { PurchaseOrderSheet } from "./purchase-order-sheet";

// The tab value of "every status". No status is this word.
const ALL_TAB = "all";
// The Delivery filter values. The URL keeps them as late=true and late=false.
const LATE = "late";
const ON_TIME = "on-time";
// Ten rows per page, as the kit order list shows.
const PAGE_SIZE = 10;

/** The list page. The URL filters apply first; RecordTable then searches, sorts, selects, and pages. */
export function PurchaseOrdersPage() {
	const { t, locale } = useT();
	const { data: orders } = useSuspenseQuery(purchaseOrdersQueryOptions());
	const search = useSearch({ from: "/app/purchase-orders" });
	const navigate = useNavigate({ from: "/app/purchase-orders" });
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

	// The Supplier filter lists only suppliers with orders, by name.
	const suppliers = [
		...new Map(orders.map((order) => [order.supplierId, order.supplierName])),
	]
		.map(([value, label]) => ({ value, label }))
		.sort((first, second) => first.label.localeCompare(second.label, locale));
	const rows = orders.filter(
		(order) =>
			(!search.status || order.status === search.status) &&
			(!search.supplier || order.supplierId === search.supplier) &&
			(search.late === undefined || order.lateDays > 0 === search.late),
	);
	const selectedOrder = orders.find((order) => order.id === search.po) ?? null;

	function exportRows(fileName: string, selected: PurchaseOrder[]) {
		downloadCsv(fileName, toCsv(selected, orderCsvColumns(t, locale)));
	}

	const columns: RecordColumn<PurchaseOrder>[] = [
		{
			id: "number",
			header: "#",
			sortValue: (order) => order.number,
			cell: (order) => (
				<Link
					from="/app/purchase-orders"
					search={(previous) => ({ ...previous, po: order.id })}
					className="text-muted-foreground tabular-nums hover:text-foreground hover:underline"
				>
					{order.number}
				</Link>
			),
		},
		{
			id: "item",
			header: t("purchaseOrders.item"),
			cell: (order) => {
				const first = order.lines[0];
				const more = order.lines.length - 1;
				return (
					<span className="flex items-center gap-4">
						<InitialsTile
							name={first?.itemName ?? order.number}
							className="size-12"
						/>
						<span className="grid min-w-0">
							<span className="max-w-56 truncate" dir="auto">
								{first?.itemName ?? ""}
							</span>
							{more > 0 ? (
								<span className="text-muted-foreground text-xs">
									{fillMessage(t("purchaseOrders.moreLines"), {
										count: number.format(more),
									})}
								</span>
							) : null}
						</span>
					</span>
				);
			},
		},
		{
			id: "total",
			header: t("purchaseOrders.total"),
			hideable: true,
			sortValue: (order) => order.total,
			cell: (order) => (
				<span className="tabular-nums">{money.format(order.total)}</span>
			),
		},
		{
			id: "supplier",
			header: t("purchaseOrders.supplier"),
			hideable: true,
			sortValue: (order) => order.supplierName,
			cell: (order) => (
				<span className="grid gap-0.5">
					<span className="font-semibold" dir="auto">
						{order.supplierName}
					</span>
					<span className="text-muted-foreground">{order.supplierEmail}</span>
				</span>
			),
		},
		{
			id: "expected",
			header: t("purchaseOrders.expected"),
			hideable: true,
			sortValue: (order) => order.expectedOn,
			cell: (order) => (
				<span className="whitespace-nowrap">
					{date.format(new Date(order.expectedOn))}
				</span>
			),
		},
		{
			id: "received",
			header: t("purchaseOrders.received"),
			hideable: true,
			sortValue: (order) => order.unitsReceived / order.unitsOrdered,
			cell: (order) => (
				<span className="whitespace-nowrap tabular-nums">
					{fillMessage(t("purchaseOrders.receivedOf"), {
						received: number.format(order.unitsReceived),
						ordered: number.format(order.unitsOrdered),
					})}
				</span>
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
		<div className="grid gap-4">
			<PageHeader
				title={t("purchaseOrders.title")}
				actions={
					<Button
						type="button"
						onClick={() => exportRows("purchase-orders.csv", rows)}
					>
						<DownloadSimpleIcon />
						{t("common.exportCsv")}
					</Button>
				}
			/>
			<Tabs
				// min-w-0: without it, the grid column takes the full width of the tab row, and the scroll row never scrolls.
				className="min-w-0"
				value={search.status ?? ALL_TAB}
				onValueChange={(value) =>
					navigate({
						search: (previous) => ({
							...previous,
							status: PURCHASE_ORDER_STATUSES.find(
								(status) => status === value,
							),
						}),
						replace: true,
					})
				}
			>
				{/* The six tabs scroll inside their row on a phone, so the page never scrolls sideways. */}
				<div className="max-w-full overflow-x-auto">
					<TabsList>
						<TabsTrigger value={ALL_TAB}>{t("purchaseOrders.all")}</TabsTrigger>
						{PURCHASE_ORDER_STATUSES.map((status) => (
							<TabsTrigger key={status} value={status}>
								{t(`orderStatuses.${status}`)}
							</TabsTrigger>
						))}
					</TabsList>
				</div>
			</Tabs>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(order) =>
					`${order.number} ${order.supplierName} ${order.lines.map((line) => line.itemName).join(" ")}`
				}
				searchPlaceholder={t("purchaseOrders.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("purchaseOrders.supplier")}
							options={suppliers}
							value={search.supplier ?? null}
							onValueChange={(value) =>
								navigate({
									search: (previous) => ({
										...previous,
										supplier: value ?? undefined,
									}),
									replace: true,
								})
							}
						/>
						<RecordFilter
							label={t("purchaseOrders.delivery")}
							options={[
								{ value: LATE, label: t("purchaseOrders.late") },
								{ value: ON_TIME, label: t("purchaseOrders.onTime") },
							]}
							value={
								search.late === undefined ? null : search.late ? LATE : ON_TIME
							}
							onValueChange={(value) =>
								navigate({
									search: (previous) => ({
										...previous,
										late: value === null ? undefined : value === LATE,
									}),
									replace: true,
								})
							}
						/>
					</>
				}
				rowMenu={(order) => (
					<>
						<DropdownMenuItem asChild>
							<Link
								from="/app/purchase-orders"
								search={(previous) => ({ ...previous, po: order.id })}
							>
								{t("purchaseOrders.openOrder")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link to="/app/items" search={{ supplier: order.supplierId }}>
								{t("purchaseOrders.supplierItems")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(order.number, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("purchaseOrders.copyNumber")}
						</DropdownMenuItem>
					</>
				)}
				selectable
				bulkActions={(selected) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() => exportRows("purchase-orders-selected.csv", selected)}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				pageSize={PAGE_SIZE}
				noResults={t("purchaseOrders.noResults")}
			/>
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

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function PurchaseOrdersPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-3">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-full max-w-xl" />
			<Skeleton className="h-9 w-full max-w-2xl" />
			<Skeleton className="h-160" />
		</div>
	);
}

/** Error state when the loader fails. */
export function PurchaseOrdersPageError() {
	const { t } = useT();
	return <LoadError message={t("purchaseOrders.loadError")} />;
}
