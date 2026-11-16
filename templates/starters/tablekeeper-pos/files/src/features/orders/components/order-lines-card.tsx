// The lines of one check with their notes, then the subtotal, the VAT inside it, the tip, and the total.
// OrderDetailPage renders it in its main column. The amounts come from the order math of ~/features/restaurant.
// A void shows its lines with a note that they are not in the sales.
// Below the md container width, the unit price moves under the item name, so the amount column stays in view.
import {
	fillMessage,
	formatCents,
	lineTotalCents,
	moneyFormat,
	type Order,
	orderSubtotalCents,
	orderTotalCents,
	orderVatCents,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

type OrderLinesCardProps = {
	order: Order;
};

/** A Card with the lines table and the totals under it, aligned on the amount column. */
export function OrderLinesCard({ order }: OrderLinesCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const isVoid = order.status === "void";

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("orderDetail.lines")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-12">
								{t("orderDetail.quantity")}
							</TableHead>
							<TableHead>{t("orderDetail.item")}</TableHead>
							<TableHead className="@md/main:table-cell hidden text-end">
								{t("orderDetail.unitPrice")}
							</TableHead>
							<TableHead className="text-end">
								{t("orderDetail.amount")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{order.lines.map((line) => (
							<TableRow key={line.id}>
								<TableCell className="tabular-nums">{line.quantity}</TableCell>
								<TableCell>
									<div className="grid justify-items-start">
										<span className="font-medium">{line.name}</span>
										<span className="text-muted-foreground text-xs">
											{line.note ?? t(`menuCategories.${line.category}`)}
										</span>
										<span className="@md/main:hidden text-muted-foreground text-xs tabular-nums">
											{fillMessage(t("orderDetail.quantityTimesPrice"), {
												count: String(line.quantity),
												price: formatCents(money, line.unitPriceCents),
											})}
										</span>
									</div>
								</TableCell>
								<TableCell className="@md/main:table-cell hidden text-end text-muted-foreground tabular-nums">
									{formatCents(money, line.unitPriceCents)}
								</TableCell>
								<TableCell className="text-end tabular-nums">
									{formatCents(money, lineTotalCents(line))}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
				<dl className="ms-auto grid w-full max-w-xs gap-2 text-sm">
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">
							{t("orderDetail.subtotal")}
						</dt>
						<dd className="tabular-nums">
							{formatCents(money, orderSubtotalCents(order))}
						</dd>
					</div>
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">
							{t("orderDetail.vatIncluded")}
						</dt>
						<dd className="text-muted-foreground tabular-nums">
							{formatCents(money, orderVatCents(order))}
						</dd>
					</div>
					{order.tipCents > 0 ? (
						<div className="flex justify-between gap-4">
							<dt className="text-muted-foreground">{t("orderDetail.tip")}</dt>
							<dd className="tabular-nums">
								{formatCents(money, order.tipCents)}
							</dd>
						</div>
					) : null}
					<div className="flex items-baseline justify-between gap-4 border-t pt-3">
						<dt className="font-medium">{t("orderDetail.total")}</dt>
						<dd
							className={
								isVoid
									? "font-numeric text-muted-foreground text-xl tabular-nums line-through"
									: "font-numeric font-semibold text-xl tabular-nums"
							}
						>
							{formatCents(money, orderTotalCents(order))}
						</dd>
					</div>
					{isVoid ? (
						<p className="text-destructive text-xs">
							{t("orderDetail.voided")}
						</p>
					) : null}
				</dl>
			</CardContent>
		</Card>
	);
}
