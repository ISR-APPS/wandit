// The orders list behind login: the page header, the status tabs, the rep filter, and the searchable table.
// The /app/orders route renders it after its loader. The route also uses the skeleton and the error below.
// A click on an order opens OrderDialog with its lines.
// On a narrow page the first cell shows the date, the rep, the amount, and the status.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	FIRST_COLUMN_WHEN_NARROW,
	fillMessage,
	moneyFormat,
	NARROW_ONLY,
	ORDER_STATUSES,
	type Order,
	type OrderStatus,
	OrderStatusBadge,
	PageError,
	RepAvatar,
	TOUCH_TAB_TRIGGER,
	WRAPPING_TABS_LIST,
} from "~/features/sales";
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
import { ordersQueryOptions } from "../api/orders.queries";
import { OrderDialog } from "./order-dialog";

// The value of the rep Select that shows every rep.
const ALL_REPS = "all";

/** The list page. The rep Select and the status tab filter the rows; then DataTable searches, sorts, and pages them. */
export function OrdersPage() {
	const { t, locale } = useT();
	const { data: orders } = useSuspenseQuery(ordersQueryOptions());
	const [status, setStatus] = useState<OrderStatus | "all">("all");
	const [repId, setRepId] = useState(ALL_REPS);
	const [openOrder, setOpenOrder] = useState<Order | null>(null);

	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
	});
	const reps = [
		...new Map(orders.map((order) => [order.repId, order.repName])),
	].sort((first, second) => first[1].localeCompare(second[1], locale));
	const repOrders =
		repId === ALL_REPS
			? orders
			: orders.filter((order) => order.repId === repId);
	// A tab shows only for a status that has rows for the chosen rep. Its count is the count of the table.
	const tabs = ORDER_STATUSES.map((value) => ({
		value,
		count: repOrders.filter((order) => order.status === value).length,
	})).filter((tab) => tab.count > 0);
	// A rep change can empty the chosen tab. Its tab then disappears, so the list shows all rows.
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const rows =
		activeStatus === "all"
			? repOrders
			: repOrders.filter((order) => order.status === activeStatus);

	// "POS terminals +1 more": the first product line and the count of the others.
	function productSummaryOf(order: Order): string {
		const first = order.lines[0];
		const label = first ? t(`productLines.${first.productLine}`) : "";
		return order.lines.length > 1
			? `${label} ${fillMessage(t("orders.moreProducts"), {
					count: number.format(order.lines.length - 1),
				})}`
			: label;
	}

	const columns: DataTableColumn<Order>[] = [
		{
			id: "account",
			header: t("orders.account"),
			sortValue: (row) => row.accountName,
			cell: (row) => (
				<div className="flex items-start justify-between gap-3">
					<div className="grid min-w-0 justify-items-start">
						<button
							type="button"
							onClick={() => setOpenOrder(row)}
							className="text-start font-medium hover:underline"
							aria-label={fillMessage(t("orders.openOrder"), {
								number: row.number,
							})}
						>
							<bdi>{row.accountName}</bdi>
						</button>
						{/* The number and the products share the second line, so the table keeps 5 columns at 1024 px. */}
						<span className="whitespace-normal @2xl/main:whitespace-nowrap text-muted-foreground text-xs">
							<span className="tabular-nums">{row.number}</span>
							{` · ${productSummaryOf(row)}`}
						</span>
						{/* The Rep and Booked columns hide on a narrow page, so their values join the cell here. */}
						<span className={cn("text-muted-foreground text-xs", NARROW_ONLY)}>
							<span className="tabular-nums">
								{date.format(new Date(row.bookedAt))}
							</span>
							{" · "}
							<bdi>{row.repName}</bdi>
						</span>
					</div>
					<div
						className={cn("grid shrink-0 justify-items-end gap-1", NARROW_ONLY)}
					>
						<span className="font-medium tabular-nums">
							{money.format(row.amount)}
						</span>
						<OrderStatusBadge status={row.status} />
					</div>
				</div>
			),
		},
		{
			id: "rep",
			header: t("orders.rep"),
			sortValue: (row) => row.repName,
			cell: (row) => (
				<span className="flex items-center gap-2">
					<RepAvatar name={row.repName} className="size-6" />
					<bdi className="whitespace-nowrap">{row.repName}</bdi>
				</span>
			),
		},
		{
			id: "status",
			header: t("orders.status"),
			sortValue: (row) => ORDER_STATUSES.indexOf(row.status),
			cell: (row) => <OrderStatusBadge status={row.status} />,
		},
		{
			id: "booked",
			header: t("orders.booked"),
			sortValue: (row) => Date.parse(row.bookedAt),
			cell: (row) => (
				<span className="whitespace-nowrap tabular-nums">
					{date.format(new Date(row.bookedAt))}
				</span>
			),
		},
		{
			id: "amount",
			header: t("orders.amount"),
			align: "end",
			sortValue: (row) => row.amount,
			cell: (row) => (
				<span className="font-medium">{money.format(row.amount)}</span>
			),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("orders.title")}
				description={t("orders.description")}
			/>
			<Card>
				<CardContent className={FIRST_COLUMN_WHEN_NARROW}>
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) =>
							`${row.accountName} ${row.number} ${row.repName} ${row.territoryName}`
						}
						noResults={t("orders.noResults")}
						toolbar={
							<>
								<Select value={repId} onValueChange={setRepId}>
									<SelectTrigger
										className="w-full sm:w-48"
										aria-label={t("orders.rep")}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL_REPS}>
											{t("orders.allReps")}
										</SelectItem>
										{reps.map(([id, name]) => (
											<SelectItem key={id} value={id}>
												{name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Tabs
									value={activeStatus}
									onValueChange={(value) =>
										setStatus(
											ORDER_STATUSES.find((option) => option === value) ??
												"all",
										)
									}
								>
									{/* The counts use opacity, not a muted color: muted text fails on the filled active tab. */}
									<TabsList className={WRAPPING_TABS_LIST}>
										<TabsTrigger value="all" className={TOUCH_TAB_TRIGGER}>
											{t("orders.all")}
											<span className="tabular-nums opacity-70">
												{number.format(repOrders.length)}
											</span>
										</TabsTrigger>
										{tabs.map((tab) => (
											<TabsTrigger
												key={tab.value}
												value={tab.value}
												className={TOUCH_TAB_TRIGGER}
											>
												{t(`orderStatuses.${tab.value}`)}
												<span className="tabular-nums opacity-70">
													{number.format(tab.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
							</>
						}
					/>
				</CardContent>
			</Card>
			<OrderDialog order={openOrder} onClose={() => setOpenOrder(null)} />
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
				<Skeleton className="h-4 w-72" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<div className="flex flex-wrap gap-2">
						<Skeleton className="h-9 w-full sm:max-w-xs" />
						<Skeleton className="h-9 w-48" />
						<Skeleton className="h-9 w-80" />
					</div>
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-11 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the page when a loader fails. The route sets it as errorComponent. */
export function OrdersPageError() {
	const { t } = useT();
	return <PageError message={t("orders.loadError")} />;
}
