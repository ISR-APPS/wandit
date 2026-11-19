// The items card of the order page: one table row for each line, then the totals of the order.
// OrderDetailPage renders it in the Overview tab (beside the other orders) and in the Items tab.
// The total is the subtotal minus the discount plus the delivery fee. A product name opens its product dialog.
import { Link } from "@tanstack/react-router";
import { fillMessage, moneyFormat, ProductTile } from "~/features/shop";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import type { OrderDetail } from "../api/orders.queries";

type OrderItemsCardProps = {
	/** The order of the page. The card reads its lines and its amounts. */
	order: OrderDetail;
};

/** Three columns: product, quantity, and amount. The unit price sits under the product name. */
export function OrderItemsCard({ order }: OrderItemsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("orders.items")}</CardTitle>
				<CardDescription>
					{fillMessage(t("orders.itemsCount"), {
						lines: number.format(order.lineCount),
						units: number.format(order.unitCount),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("orders.product")}</TableHead>
							<TableHead className="text-end">{t("orders.quantity")}</TableHead>
							<TableHead className="text-end">
								{t("orders.lineTotal")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{order.lines.map((line) => (
							<TableRow key={line.id}>
								<TableCell className="whitespace-normal">
									<div className="flex items-center gap-3">
										<ProductTile category={line.category} className="size-8" />
										<div className="grid min-w-0 justify-items-start">
											<Link
												to="/app/products"
												search={{ product: line.productId }}
												className="font-medium hover:underline"
											>
												{line.productName}
											</Link>
											<span className="text-muted-foreground text-xs tabular-nums">
												{`${line.sku} · ${money.format(line.unitPrice)}`}
											</span>
										</div>
									</div>
								</TableCell>
								<TableCell className="text-end tabular-nums">
									{number.format(line.quantity)}
								</TableCell>
								<TableCell className="text-end font-medium tabular-nums">
									{money.format(line.quantity * line.unitPrice)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
				{/* The totals sit under the amount column. px-2 is the side padding of a table cell. */}
				<dl className="grid w-full max-w-xs gap-2 justify-self-end px-2 text-sm">
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">{t("orders.subtotal")}</dt>
						<dd className="tabular-nums">{money.format(order.subtotal)}</dd>
					</div>
					{order.discountCode ? (
						<div className="flex justify-between gap-4">
							<dt className="text-muted-foreground">
								{fillMessage(t("orders.discount"), {
									code: order.discountCode,
								})}
							</dt>
							<dd className="tabular-nums">
								<bdi dir="ltr">{money.format(-order.discount)}</bdi>
							</dd>
						</div>
					) : null}
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">
							{t(`orders.shippingFee.${order.shippingMethod}`)}
						</dt>
						<dd className="tabular-nums">
							{order.shippingFee === 0
								? t("orders.free")
								: money.format(order.shippingFee)}
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-4 border-t pt-2 font-semibold">
						<dt>{t("orders.total")}</dt>
						<dd className="text-base tabular-nums">
							{money.format(order.total)}
						</dd>
					</div>
					{/* A refunded order paid the total back, so the card shows the refund under the total. */}
					{order.status === "refunded" ? (
						<div className="flex justify-between gap-4">
							<dt className="text-muted-foreground">{t("orders.refunded")}</dt>
							<dd className="tabular-nums">
								<bdi dir="ltr">{money.format(-order.total)}</bdi>
							</dd>
						</div>
					) : null}
				</dl>
			</CardContent>
		</Card>
	);
}
