// The side panel of one purchase order: its badges, its supplier, its dates, its lines, and its history.
// The order list opens it from the `po` search param, so the home, the item page, and the bell can link to one order.
import { Link } from "@tanstack/react-router";
import { moneyFormat, OrderStatusBadge, unitWord } from "~/features/stock";
import { useT } from "~/shared/i18n";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import type { PurchaseOrder } from "../api/purchase-orders.queries";
import { PurchaseOrderTimeline } from "./purchase-order-timeline";

type PurchaseOrderSheetProps = {
	/** The order to show. null keeps the panel closed. */
	order: PurchaseOrder | null;
	/** Closing removes `po` from the URL. */
	onClose: () => void;
};

/** A controlled Sheet at the end side. It scrolls inside itself; the page behind stays in place. */
export function PurchaseOrderSheet({
	order,
	onClose,
}: PurchaseOrderSheetProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const lastReceipt = order?.receipts.at(-1);
	const facts = order
		? [
				{
					label: t("purchaseOrders.created"),
					value: date.format(new Date(order.createdAt)),
				},
				{
					label: t("purchaseOrders.sent"),
					value: order.orderedAt
						? date.format(new Date(order.orderedAt))
						: t("purchaseOrders.notSent"),
				},
				{
					label: t("purchaseOrders.expected"),
					value: date.format(new Date(order.expectedOn)),
				},
				{
					label: t("purchaseOrders.lastDelivery"),
					value: lastReceipt
						? date.format(new Date(lastReceipt.receivedAt))
						: t("items.none"),
				},
			]
		: [];

	return (
		<Sheet
			open={order !== null}
			onOpenChange={(open) => (open ? null : onClose())}
		>
			<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
				{order ? (
					<>
						<SheetHeader className="gap-2 border-b p-6 pe-12">
							<SheetTitle className="font-display text-xl">
								{order.number}
							</SheetTitle>
							<OrderStatusBadge
								status={order.status}
								lateDays={order.lateDays}
							/>
							<SheetDescription>
								{/* The supplier name opens the items of the supplier. */}
								<Link
									to="/app/items"
									search={{ supplier: order.supplierId }}
									className="inline-flex min-h-11 items-center font-medium text-foreground hover:underline"
								>
									{order.supplierName}
								</Link>
							</SheetDescription>
						</SheetHeader>
						<div className="grid gap-8 p-6">
							<dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
								{facts.map((fact) => (
									<div key={fact.label} className="grid gap-0.5">
										<dt className="text-muted-foreground">{fact.label}</dt>
										<dd className="font-medium tabular-nums">{fact.value}</dd>
									</div>
								))}
							</dl>
							<section className="grid gap-3">
								<h2 className="font-semibold text-sm">
									{t("purchaseOrders.lines")}
								</h2>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>{t("purchaseOrders.item")}</TableHead>
											<TableHead className="text-end">
												{t("purchaseOrders.received")}
											</TableHead>
											<TableHead className="text-end">
												{t("purchaseOrders.lineTotal")}
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{order.lines.map((line) => (
											<TableRow key={line.itemId} className="relative">
												<TableCell>
													<div className="grid justify-items-start gap-0.5">
														<Link
															to="/app/items/$itemId"
															params={{ itemId: line.itemId }}
															className="font-medium after:absolute after:inset-0 hover:underline"
															dir="auto"
														>
															{line.itemName}
														</Link>
														<span className="font-numeric text-muted-foreground text-xs">
															{`${line.sku} · ${money.format(line.unitCost)}`}
														</span>
													</div>
												</TableCell>
												<TableCell className="text-end tabular-nums">
													{`${number.format(line.quantityReceived)} / ${number.format(line.quantityOrdered)}`}
													<span className="block text-muted-foreground text-xs">
														{unitWord(
															line.quantityOrdered,
															line.unit,
															t,
															locale,
														)}
													</span>
												</TableCell>
												<TableCell className="text-end tabular-nums">
													{money.format(line.total)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
									<TableFooter>
										<TableRow>
											<TableCell colSpan={2}>
												{t("purchaseOrders.total")}
											</TableCell>
											<TableCell className="text-end tabular-nums">
												{money.format(order.total)}
											</TableCell>
										</TableRow>
									</TableFooter>
								</Table>
							</section>
							<section className="grid gap-3">
								<h2 className="font-semibold text-sm">
									{t("purchaseOrders.historyTitle")}
								</h2>
								<PurchaseOrderTimeline order={order} />
							</section>
						</div>
					</>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
