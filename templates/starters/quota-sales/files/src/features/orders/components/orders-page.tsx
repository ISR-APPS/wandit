// The orders list behind login: the header with Export, the status tabs,
// then the table with the filter field, the territory and product filters, the column menu, and the row menu.
// The /app/orders route renders it after its loader. "View order" in a row menu opens OrderDialog.
// The status tab and the filters are state; the rows of the table are derived during render.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	copyToClipboard,
	downloadCsv,
	initialsOf,
	moneyFormat,
	ORDER_STATUSES,
	type Order,
	type OrderStatus,
	OrderStatusBadge,
	PageError,
	PRODUCT_LINES,
	toCsv,
} from "~/features/sales";
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
import { ordersQueryOptions } from "../api/orders.queries";
import { orderCsvColumns } from "../lib/order-csv";
import { OrderDialog } from "./order-dialog";

// Shows 10 rows per page. 10 rows fit one laptop screen under the filters.
const PAGE_SIZE = 10;

/** The list page. The tab and the two filters narrow the rows; RecordTable searches, sorts, and pages them. */
export function OrdersPage() {
	const { t, locale } = useT();
	const { data: orders } = useSuspenseQuery(ordersQueryOptions());
	const [status, setStatus] = useState<OrderStatus | "all">("all");
	const [territory, setTerritory] = useState<string | null>(null);
	const [product, setProduct] = useState<string | null>(null);
	const [openOrder, setOpenOrder] = useState<Order | null>(null);
	const money = moneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const territories = [...new Set(orders.map((order) => order.territoryName))]
		.sort((first, second) => first.localeCompare(second, locale))
		.map((name) => ({ value: name, label: name }));

	const rows = orders.filter(
		(order) =>
			(status === "all" || order.status === status) &&
			(territory === null || order.territoryName === territory) &&
			(product === null ||
				order.lines.some((line) => line.productLine === product)),
	);

	const columns: RecordColumn<Order>[] = [
		{
			id: "number",
			header: "#",
			cell: (order) => (
				<button
					type="button"
					onClick={() => setOpenOrder(order)}
					className="text-muted-foreground tabular-nums hover:text-primary hover:underline"
				>
					{order.number}
				</button>
			),
		},
		{
			id: "account",
			header: t("orders.account"),
			cell: (order) => (
				<div className="flex items-center gap-4">
					<span
						aria-hidden="true"
						className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted font-medium text-xs"
					>
						{initialsOf(order.accountName)}
					</span>
					<bdi>{order.accountName}</bdi>
				</div>
			),
		},
		{
			id: "amount",
			header: t("orders.amount"),
			hideable: true,
			sortValue: (order) => order.amount,
			cell: (order) => money.format(order.amount),
		},
		{
			id: "rep",
			header: t("orders.rep"),
			hideable: true,
			cell: (order) => (
				<div className="grid gap-1">
					<Link
						to="/app/reps/$repId"
						params={{ repId: order.repId }}
						className="font-semibold hover:underline"
					>
						{order.repName}
					</Link>
					<span className="text-muted-foreground">{order.territoryName}</span>
				</div>
			),
		},
		{
			id: "booked",
			header: t("orders.booked"),
			hideable: true,
			sortValue: (order) => order.bookedAt,
			cell: (order) => date.format(new Date(order.bookedAt)),
		},
		{
			id: "segment",
			header: t("orders.segment"),
			hideable: true,
			cell: (order) => t(`segments.${order.segment}`),
		},
		{
			id: "status",
			header: t("orders.status"),
			sortValue: (order) => ORDER_STATUSES.indexOf(order.status),
			cell: (order) => <OrderStatusBadge status={order.status} />,
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("orders.title")}
				description={t("orders.description")}
				actions={
					<Button
						type="button"
						onClick={() =>
							downloadCsv("orders.csv", toCsv(rows, orderCsvColumns(t)))
						}
					>
						<DownloadSimpleIcon />
						{t("common.exportCsv")}
					</Button>
				}
			/>
			<Tabs
				value={status}
				onValueChange={(value) =>
					setStatus(ORDER_STATUSES.find((option) => option === value) ?? "all")
				}
			>
				{/* The list scrolls sideways on a phone, so the 6 tabs never widen the page. */}
				<div className="max-w-full overflow-x-auto">
					<TabsList aria-label={t("orders.status")}>
						<TabsTrigger value="all">{t("orders.all")}</TabsTrigger>
						{ORDER_STATUSES.map((option) => (
							<TabsTrigger key={option} value={option}>
								{t(`orderStatuses.${option}`)}
							</TabsTrigger>
						))}
					</TabsList>
				</div>
			</Tabs>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(order) =>
					`${order.number} ${order.accountName} ${order.repName}`
				}
				searchPlaceholder={t("orders.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("reps.territory")}
							options={territories}
							value={territory}
							onValueChange={setTerritory}
						/>
						<RecordFilter
							label={t("orders.product")}
							options={PRODUCT_LINES.map((line) => ({
								value: line,
								label: t(`productLines.${line}`),
							}))}
							value={product}
							onValueChange={setProduct}
						/>
					</>
				}
				selectable
				bulkActions={(selected) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv(
								"orders-selected.csv",
								toCsv(selected, orderCsvColumns(t)),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				rowMenu={(order) => (
					<>
						<DropdownMenuItem onSelect={() => setOpenOrder(order)}>
							{t("orders.viewOrder")}
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link to="/app/reps/$repId" params={{ repId: order.repId }}>
								{t("orders.openRep")}
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
							{t("orders.copyNumber")}
						</DropdownMenuItem>
					</>
				)}
				pageSize={PAGE_SIZE}
				noResults={t("orders.noResults")}
			/>
			<OrderDialog order={openOrder} onClose={() => setOpenOrder(null)} />
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function OrdersPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-72 max-w-full" />
			</div>
			<Skeleton className="h-9 w-96 max-w-full" />
			<div className="flex flex-wrap gap-2">
				<Skeleton className="h-9 w-full sm:max-w-sm" />
				<Skeleton className="h-9 w-48" />
			</div>
			<div className="grid gap-2">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-14 w-full" />
				))}
			</div>
		</div>
	);
}

/** Error state of the page when a loader fails. The route sets it as errorComponent. */
export function OrdersPageError() {
	const { t } = useT();
	return <PageError message={t("orders.loadError")} />;
}
