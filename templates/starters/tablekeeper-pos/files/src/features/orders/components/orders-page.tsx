// The list of the checks of the business day, in the anatomy of the kit order list.
// The header with "New order", the status tabs, then RecordTable with a search, 2 filter buttons, and a column menu.
// The /app/orders route renders it after its loader. The route also uses the skeleton and the error below.
import { PlusIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	copyToClipboard,
	countLabel,
	downloadCsv,
	fillMessage,
	formatCents,
	formatClock,
	moneyFormat,
	ORDER_STATUS_BADGE,
	ORDER_STATUSES,
	type Order,
	type OrderStatus,
	orderCsvColumns,
	orderSubtotalCents,
	ordersQueryOptions,
	toCsv,
	ZONES,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";

// 10 rows per page, as the kit order list.
const PAGE_SIZE = 10;

/** The tab value of every status. A status never takes this value. */
const ALL = "all";

/** The tab and the 2 filters cut the rows; then RecordTable searches, sorts, selects, and pages them. */
export function OrdersPage() {
	const { t, locale } = useT();
	const { data: orders } = useSuspenseQuery(ordersQueryOptions());
	const [status, setStatus] = useState<OrderStatus | typeof ALL>(ALL);
	const [serverId, setServerId] = useState<string | null>(null);
	const [zone, setZone] = useState<string | null>(null);

	const money = moneyFormat(locale);
	// The servers of the day, in the order of their first check.
	const servers = [
		...new Map(orders.map((order) => [order.serverId, order.serverName])),
	];
	const rows = orders.filter(
		(order) =>
			(status === ALL || order.status === status) &&
			(serverId === null || order.serverId === serverId) &&
			(zone === null || order.zone === zone),
	);
	const firstOrder = orders.at(-1);

	const columns: RecordColumn<Order>[] = [
		{
			id: "check",
			header: "#",
			cell: (order) => (
				<Link
					to="/app/orders/$orderId"
					params={{ orderId: order.id }}
					className="text-muted-foreground tabular-nums hover:text-foreground hover:underline"
				>
					#{order.number}
				</Link>
			),
		},
		{
			id: "table",
			header: t("orders.table"),
			cell: (order) => (
				<span className="flex items-center gap-4">
					{/* A table has no photo: its name in a tile stands in for the kit product image. */}
					<span
						aria-hidden="true"
						className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted font-medium text-muted-foreground text-sm"
					>
						{order.tableName}
					</span>
					<span>{t(`zones.${order.zone}`)}</span>
				</span>
			),
		},
		{
			id: "total",
			header: t("orders.total"),
			cell: (order) => (
				<span
					className={
						order.status === "void"
							? "text-muted-foreground line-through"
							: undefined
					}
				>
					{formatCents(money, orderSubtotalCents(order))}
				</span>
			),
			sortValue: (order) => orderSubtotalCents(order),
			hideable: true,
		},
		{
			id: "server",
			header: t("orders.server"),
			cell: (order) => (
				<span className="grid">
					<span className="font-medium">{order.serverName}</span>
					<span className="text-muted-foreground text-xs">
						{countLabel(
							order.covers,
							t("counts.covers.one"),
							t("counts.covers.other"),
							locale,
						)}
					</span>
				</span>
			),
			hideable: true,
		},
		{
			id: "opened",
			header: t("orders.opened"),
			cell: (order) => (
				<span className="tabular-nums">
					{formatClock(order.openedAt, locale)}
				</span>
			),
			sortValue: (order) => order.openedAt,
			hideable: true,
		},
		{
			id: "payment",
			header: t("orders.payment"),
			cell: (order) =>
				order.payment ? t(`payments.${order.payment}`) : t("orders.notPaid"),
			hideable: true,
		},
		{
			id: "status",
			header: t("orders.status"),
			cell: (order) => (
				<Badge variant={ORDER_STATUS_BADGE[order.status]}>
					{t(`orderStatuses.${order.status}`)}
				</Badge>
			),
			sortValue: (order) => ORDER_STATUSES.indexOf(order.status),
			hideable: true,
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("orders.title")}
				description={
					firstOrder
						? fillMessage(t("orders.description"), {
								checks: countLabel(
									orders.length,
									t("counts.checks.one"),
									t("counts.checks.other"),
									locale,
								),
								time: formatClock(firstOrder.openedAt, locale),
							})
						: t("orders.empty")
				}
				actions={
					<Button asChild>
						<Link to="/app/order">
							<PlusIcon />
							{t("orders.newOrder")}
						</Link>
					</Button>
				}
			/>
			<Tabs
				value={status}
				onValueChange={(value) => {
					const next = ORDER_STATUSES.find((entry) => entry === value);
					setStatus(next ?? ALL);
				}}
			>
				{/* The tab row scrolls inside the page at 375 px, so the page never scrolls sideways. */}
				<div className="max-w-full overflow-x-auto">
					<TabsList>
						<TabsTrigger value={ALL}>{t("orders.all")}</TabsTrigger>
						{ORDER_STATUSES.map((value) => (
							<TabsTrigger key={value} value={value}>
								{t(`orderStatuses.${value}`)}
							</TabsTrigger>
						))}
					</TabsList>
				</div>
			</Tabs>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(order) =>
					`${order.number} ${order.tableName} ${order.serverName}`
				}
				searchPlaceholder={t("orders.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("orders.server")}
							options={servers.map(([id, name]) => ({
								value: id,
								label: name,
							}))}
							value={serverId}
							onValueChange={setServerId}
						/>
						<RecordFilter
							label={t("orders.zone")}
							options={ZONES.map((value) => ({
								value,
								label: t(`zones.${value}`),
							}))}
							value={zone}
							onValueChange={setZone}
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
								"checks-selected.csv",
								toCsv(selected, orderCsvColumns(t, locale)),
							)
						}
					>
						{t("table.exportSelected")}
					</Button>
				)}
				rowMenu={(order) => (
					<>
						<DropdownMenuItem asChild>
							<Link to="/app/orders/$orderId" params={{ orderId: order.id }}>
								{t("orders.openCheck")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(String(order.number), {
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
				noResults={
					orders.length === 0 ? t("orders.empty") : t("orders.noResults")
				}
			/>
		</div>
	);
}

/** Placeholder while the list loader runs: the header, the tabs, and the table. */
export function OrdersPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-64 max-w-full" />
			</div>
			<Skeleton className="h-9 w-full max-w-md" />
			<Skeleton className="h-9 w-full max-w-lg" />
			<Skeleton className="h-96 w-full" />
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
