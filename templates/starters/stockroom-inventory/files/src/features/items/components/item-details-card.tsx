// The record of one item: SKU, family, bin, price, value, and its supplier with the lead time.
// The item page renders it at the top of its rail.
import { Link } from "@tanstack/react-router";
import { moneyFormat, type SupplierRow } from "~/features/stock";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { StockItem } from "../api/items.queries";

type ItemDetailsCardProps = {
	item: StockItem;
	/** The supplier of the item. Its name links to the supplier panel. */
	supplier: SupplierRow;
};

/** A definition list, one fact per row: the label at the start, the value at the end. */
export function ItemDetailsCard({ item, supplier }: ItemDetailsCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const days = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const rows = [
		{ label: t("itemDetail.sku"), value: item.sku, isCode: true },
		{ label: t("itemDetail.bin"), value: item.bin, isCode: true },
		{
			label: t("itemDetail.category"),
			value: t(`categories.${item.category}`),
			isCode: false,
		},
		{
			label: t("itemDetail.unitCost"),
			value: money.format(item.unitCost),
			isCode: false,
		},
		{
			label: t("itemDetail.stockValue"),
			value: money.format(item.stockValue),
			isCode: false,
		},
		{
			label: t("itemDetail.leadTime"),
			value: days.format(supplier.leadTimeDays),
			isCode: false,
		},
	];

	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle>{t("itemDetail.details")}</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="grid gap-2.5 text-sm">
					{rows.map((row) => (
						<div
							key={row.label}
							className="flex items-baseline justify-between gap-4"
						>
							<dt className="text-muted-foreground">{row.label}</dt>
							<dd
								className={
									row.isCode
										? "font-numeric tabular-nums"
										: "text-end font-medium tabular-nums"
								}
							>
								{row.value}
							</dd>
						</div>
					))}
					<div className="flex items-baseline justify-between gap-4 border-t pt-2.5">
						<dt className="text-muted-foreground">
							{t("itemDetail.supplier")}
						</dt>
						<dd className="min-w-0 text-end">
							<Link
								to="/app/suppliers"
								search={{ supplier: supplier.id }}
								className="inline-flex min-h-11 items-center font-medium hover:underline"
							>
								{supplier.name}
							</Link>
						</dd>
					</div>
				</dl>
			</CardContent>
		</Card>
	);
}
