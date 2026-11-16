// The items card of the order page: one row for each line, then the totals of the order.
// OrderDetailPage renders it. The total is the subtotal minus the discount plus the delivery fee.
// A product name opens the dialog of that product on the product page.
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

/** The amounts of one column have the same format, so they align on the cents. */
export function OrderItemsCard({ order }: OrderItemsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const isRefunded = order.status === "refunded";

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
							{/* On a phone the price and the quantity sit under the product name, so the table needs no side scroll. */}
							<TableHead className="hidden text-end sm:table-cell">
								{t("orders.price")}
							</TableHead>
							<TableHead className="hidden text-end sm:table-cell">
								{t("orders.quantity")}
							</TableHead>
							<TableHead className="text-end">
								{t("orders.lineTotal")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{order.lines.map((line) => (
							<TableRow key={line.id}>
								<TableCell className="max-sm:whitespace-normal">
									<div className="flex items-center gap-3">
										<ProductTile category={line.category} />
										<div className="grid justify-items-start">
											<Link
												to="/app/products"
												search={{ product: line.productId }}
												className="relative font-medium hover:underline max-sm:before:absolute max-sm:before:-inset-3"
											>
												{line.productName}
											</Link>
											<span className="text-muted-foreground text-xs">
												{line.sku}
											</span>
											<span className="text-muted-foreground text-xs tabular-nums sm:hidden">
												{`${number.format(line.quantity)} × ${money.format(line.unitPrice)}`}
											</span>
										</div>
									</div>
								</TableCell>
								<TableCell className="hidden text-end tabular-nums sm:table-cell">
									{money.format(line.unitPrice)}
								</TableCell>
								<TableCell className="hidden text-end tabular-nums sm:table-cell">
									{number.format(line.quantity)}
								</TableCell>
								<TableCell className="text-end font-medium tabular-nums">
									{money.format(line.quantity * line.unitPrice)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
				{/* The totals sit under the amount column, at the end side. px-2 is the side padding of a table cell. */}
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
						<dd className="font-numeric text-base">
							{money.format(order.total)}
						</dd>
					</div>
					{isRefunded ? (
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
