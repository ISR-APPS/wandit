// The "Track checks" card of the home: 4 step figures with a bar each, then the table of the checks of the day.
// DashboardPage renders it at the end of the second band, as the kit order status card.
// "Export" downloads every check of the day as CSV. The table filters, hides columns, and pages in the browser.
import { ExportIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	countLabel,
	downloadCsv,
	fillMessage,
	formatCents,
	moneyFormat,
	ORDER_STATUS_BADGE,
	type Order,
	orderCsvColumns,
	orderItemCount,
	orderSubtotalCents,
	toCsv,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";
import type { CheckStep } from "../lib/dashboard";

// Each step keeps one chart color on its track and its bar. The word under the figure names the step too.
const STEP_BAR = {
	in_kitchen: "bg-chart-1/20 [&_[data-slot=progress-indicator]]:bg-chart-1",
	served: "bg-chart-2/20 [&_[data-slot=progress-indicator]]:bg-chart-2",
	bill: "bg-chart-3/20 [&_[data-slot=progress-indicator]]:bg-chart-3",
	paid: "bg-chart-4/20 [&_[data-slot=progress-indicator]]:bg-chart-4",
} satisfies Record<CheckStep["status"], string>;

// 6 rows, as the kit card: the table stays inside the height of the band.
const PAGE_SIZE = 6;

type CheckStatusCardProps = {
	/** The 4 steps of the service with their count and share. */
	steps: CheckStep[];
	/** Every check of the day, newest first. */
	orders: Order[];
};

/** The step figures sit in one row from the @3xl/main width, 2 per row below. */
export function CheckStatusCard({ steps, orders }: CheckStatusCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });

	const columns: RecordColumn<Order>[] = [
		{
			id: "check",
			header: t("orders.check"),
			cell: (order) => (
				<Link
					to="/app/orders/$orderId"
					params={{ orderId: order.id }}
					className="font-medium tabular-nums hover:underline"
				>
					#{order.number}
				</Link>
			),
		},
		{
			id: "table",
			header: t("orders.table"),
			cell: (order) => order.tableName,
			hideable: true,
		},
		{
			id: "items",
			header: t("orders.items"),
			cell: (order) =>
				countLabel(
					orderItemCount(order),
					t("counts.items.one"),
					t("counts.items.other"),
					locale,
				),
			hideable: true,
		},
		{
			id: "amount",
			header: t("orders.total"),
			cell: (order) => formatCents(money, orderSubtotalCents(order)),
			hideable: true,
		},
		{
			id: "server",
			header: t("orders.server"),
			cell: (order) => order.serverName,
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
				<CardTitle>{t("dashboard.trackChecks")}</CardTitle>
				<CardDescription>
					{t("dashboard.trackChecksDescription")}
				</CardDescription>
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
				<ul className="mb-8 grid @3xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
					{steps.map((step) => (
						<li key={step.status} className="grid gap-2">
							<span className="font-numeric @4xl/main:text-3xl text-2xl tabular-nums">
								{number.format(step.count)}
							</span>
							<span className="flex flex-wrap items-center gap-x-2 text-sm">
								<span className="text-muted-foreground">
									{t(`orderStatuses.${step.status}`)}
								</span>
								<span className="text-muted-foreground text-xs tabular-nums">
									{fillMessage(t("dashboard.shareOfChecks"), {
										share: percent.format(step.share),
									})}
								</span>
							</span>
							<Progress
								value={Math.round(step.share * 100)}
								aria-label={t(`orderStatuses.${step.status}`)}
								className={cn("h-2", STEP_BAR[step.status])}
							/>
						</li>
					))}
				</ul>
				<RecordTable
					rows={orders}
					columns={columns}
					searchText={(order) =>
						`${order.number} ${order.tableName} ${order.serverName}`
					}
					searchPlaceholder={t("dashboard.filterChecks")}
					pageSize={PAGE_SIZE}
					noResults={t("orders.noResults")}
				/>
			</CardContent>
		</Card>
	);
}
