// The "Recent checks" card of the day report, as the kit recent-orders card: Export, a filter field, and a table.
// Columns: check, server with initials, table, amount (sortable), status, and a row menu. 8 rows per page.
// ReportPage renders it at the start of the last band. Export downloads every check of the day as CSV.
import { ExportIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	copyToClipboard,
	downloadCsv,
	formatCents,
	moneyFormat,
	ORDER_STATUS_BADGE,
	type Order,
	orderCsvColumns,
	orderSubtotalCents,
	toCsv,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";

// 8 rows per page, as the kit recent-orders card.
const PAGE_SIZE = 8;

/** The first letter of the first two words of a name: "Lena Moreau" gives "LM". */
function initialsOf(name: string): string {
	return name
		.split(" ")
		.slice(0, 2)
		.map((word) => word.charAt(0))
		.join("")
		.toLocaleUpperCase();
}

type RecentChecksCardProps = {
	/** Every check of the day, newest first. */
	orders: Order[];
};

/** The row menu opens the check or copies its number. */
export function RecentChecksCard({ orders }: RecentChecksCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);

	const columns: RecordColumn<Order>[] = [
		{
			id: "check",
			header: t("orders.check"),
			cell: (order) => (
				<Link
					to="/app/orders/$orderId"
					params={{ orderId: order.id }}
					className="text-muted-foreground tabular-nums hover:underline"
				>
					#{order.number}
				</Link>
			),
		},
		{
			id: "server",
			header: t("orders.server"),
			cell: (order) => (
				<span className="flex items-center gap-3">
					<Avatar className="size-8">
						<AvatarFallback className="text-xs">
							{initialsOf(order.serverName)}
						</AvatarFallback>
					</Avatar>
					<span className="whitespace-nowrap">{order.serverName}</span>
				</span>
			),
			hideable: true,
		},
		{
			id: "table",
			header: t("orders.table"),
			cell: (order) => order.tableName,
			hideable: true,
		},
		{
			id: "amount",
			header: t("orders.total"),
			cell: (order) => (
				<span className="tabular-nums">
					{formatCents(money, orderSubtotalCents(order))}
				</span>
			),
			sortValue: (order) => orderSubtotalCents(order),
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
			hideable: true,
		},
	];

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("report.recentChecks")}</CardTitle>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						aria-label={t("common.export")}
						onClick={() =>
							downloadCsv(
								"checks-today.csv",
								toCsv(orders, orderCsvColumns(t, locale)),
							)
						}
					>
						<ExportIcon />
						<span className="hidden lg:inline">{t("common.export")}</span>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<RecordTable
					rows={orders}
					columns={columns}
					searchText={(order) =>
						`${order.number} ${order.tableName} ${order.serverName}`
					}
					searchPlaceholder={t("report.filterChecks")}
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
					noResults={t("orders.noResults")}
				/>
			</CardContent>
		</Card>
	);
}
