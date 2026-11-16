// The list of the checks of the business day: the status tabs, the server filter, and the searchable table.
// The /app/orders route renders it after its loader. The route also uses the skeleton and the error below.
// A check number opens its detail page. The tab counts equal the rows that each tab shows.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	fillMessage,
	formatCents,
	formatClock,
	moneyFormat,
	ORDER_STATUS_BADGE,
	ORDER_STATUSES,
	type Order,
	type OrderStatus,
	orderItemCount,
	ordersQueryOptions,
	orderTotalCents,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
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

// The Select value of "every server". A server id never takes this value.
const ALL_SERVERS = "all";

/** The list page. The tab and the server filter cut the rows; then DataTable searches, sorts, and pages them. */
export function OrdersPage() {
	const { t, locale } = useT();
	const { data: orders } = useSuspenseQuery(ordersQueryOptions());
	const [status, setStatus] = useState<OrderStatus | "all">("all");
	const [serverId, setServerId] = useState(ALL_SERVERS);

	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	// The servers of the day, in the order of their first check.
	const servers = [
		...new Map(orders.map((order) => [order.serverId, order.serverName])),
	];
	const byServer =
		serverId === ALL_SERVERS
			? orders
			: orders.filter((order) => order.serverId === serverId);
	// A tab shows only for a status that has rows, and counts the rows of the chosen server.
	const tabs = ORDER_STATUSES.map((value) => ({
		value,
		count: byServer.filter((order) => order.status === value).length,
	})).filter((tab) => tab.count > 0);
	// A server change can empty the chosen tab. Its tab then disappears, so the list shows all rows.
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const rows =
		activeStatus === "all"
			? byServer
			: byServer.filter((order) => order.status === activeStatus);
	const firstOrder = orders.at(-1);

	// The money closes the row at the end. The phone sees the first 2 columns, so the status cell repeats the total there.
	const columns: DataTableColumn<Order>[] = [
		{
			id: "check",
			header: t("orders.check"),
			sortValue: (row) => row.number,
			cell: (row) => (
				<div className="grid justify-items-start">
					<Link
						to="/app/orders/$orderId"
						params={{ orderId: row.id }}
						className="font-medium tabular-nums hover:underline"
					>
						#{row.number}
					</Link>
					<span className="text-muted-foreground text-xs">
						{row.tableName} · {t(`zones.${row.zone}`)}
					</span>
				</div>
			),
		},
		{
			id: "status",
			header: t("orders.status"),
			sortValue: (row) => ORDER_STATUSES.indexOf(row.status),
			cell: (row) => (
				<div className="grid justify-items-start gap-1">
					<Badge variant={ORDER_STATUS_BADGE[row.status]}>
						{t(`orderStatuses.${row.status}`)}
					</Badge>
					<span
						className={
							row.status === "void"
								? "@xl/main:hidden text-muted-foreground text-xs tabular-nums line-through"
								: "@xl/main:hidden font-medium text-xs tabular-nums"
						}
					>
						{formatCents(money, orderTotalCents(row))}
					</span>
				</div>
			),
		},
		{
			id: "server",
			header: t("orders.server"),
			sortValue: (row) => row.serverName,
			cell: (row) => row.serverName,
		},
		{
			id: "opened",
			header: t("orders.opened"),
			sortValue: (row) => Date.parse(row.openedAt),
			cell: (row) => (
				<span className="text-muted-foreground tabular-nums">
					{formatClock(row.openedAt, locale)}
				</span>
			),
		},
		{
			id: "covers",
			header: t("orders.covers"),
			align: "end",
			sortValue: (row) => row.covers,
			cell: (row) => number.format(row.covers),
		},
		{
			id: "items",
			header: t("orders.items"),
			align: "end",
			sortValue: (row) => orderItemCount(row),
			cell: (row) => number.format(orderItemCount(row)),
		},
		{
			id: "total",
			header: t("orders.total"),
			align: "end",
			sortValue: (row) => orderTotalCents(row),
			cell: (row) => (
				<span
					className={
						row.status === "void"
							? "text-muted-foreground line-through"
							: "font-medium"
					}
				>
					{formatCents(money, orderTotalCents(row))}
				</span>
			),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("orders.title")}
				description={
					firstOrder
						? fillMessage(t("orders.description"), {
								count: number.format(orders.length),
								time: formatClock(firstOrder.openedAt, locale),
							})
						: undefined
				}
				actions={
					<Button asChild>
						<Link to="/app/order">{t("orders.newOrder")}</Link>
					</Button>
				}
			/>
			{orders.length === 0 ? (
				<Card>
					<CardContent className="grid justify-items-center gap-3 py-10 text-center">
						<p className="text-muted-foreground text-sm">{t("orders.empty")}</p>
						<Button asChild variant="outline">
							<Link to="/app/order">{t("orders.newOrder")}</Link>
						</Button>
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent>
						<DataTable
							rows={rows}
							columns={columns}
							searchText={(row) =>
								`#${row.number} ${row.tableName} ${row.serverName}`
							}
							noResults={t("orders.noResults")}
							toolbar={
								<>
									<Tabs
										value={activeStatus}
										onValueChange={(value) =>
											setStatus(
												ORDER_STATUSES.find((option) => option === value) ??
													"all",
											)
										}
										className="max-w-full"
									>
										{/* The tabs wrap on a phone, so no status tab hides behind the edge. */}
										<TabsList className="h-auto flex-wrap justify-start group-data-[orientation=horizontal]/tabs:h-auto">
											<TabsTrigger value="all" className="h-8 flex-none">
												{t("orders.all")}
												<span className="tabular-nums opacity-70">
													{number.format(byServer.length)}
												</span>
											</TabsTrigger>
											{tabs.map((tab) => (
												<TabsTrigger
													key={tab.value}
													value={tab.value}
													className="h-8 flex-none"
												>
													{t(`orderStatuses.${tab.value}`)}
													<span className="tabular-nums opacity-70">
														{number.format(tab.count)}
													</span>
												</TabsTrigger>
											))}
										</TabsList>
									</Tabs>
									<Select value={serverId} onValueChange={setServerId}>
										<SelectTrigger
											className="@xl/main:w-44 w-full"
											aria-label={t("orders.server")}
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={ALL_SERVERS}>
												{t("orders.allServers")}
											</SelectItem>
											{servers.map(([id, name]) => (
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
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-64" />
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-xl" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the orders pages when a loader fails. Try again runs the loader again. */
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
