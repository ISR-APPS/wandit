// The stock level of one item: the on-hand figure, the gauge against the minimum, and the planning numbers.
// The item page renders it first in its main column.
import { formatQuantity, StockGauge, unitWord } from "~/features/stock";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { StockItem } from "../api/items.queries";

type ItemStockCardProps = {
	item: StockItem;
};

/** The figure and the gauge on the start side; four planning numbers in a grid on the end side. */
export function ItemStockCard({ item }: ItemStockCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
	const days = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
		maximumFractionDigits: 0,
	});
	const facts = [
		{
			label: t("itemDetail.minimum"),
			value: formatQuantity(item.minimum, item.unit, t, locale),
		},
		{
			label: t("itemDetail.reorderQuantity"),
			value: formatQuantity(item.reorderQuantity, item.unit, t, locale),
		},
		{
			label: t("itemDetail.onOrder"),
			value:
				item.onOrder > 0
					? formatQuantity(item.onOrder, item.unit, t, locale)
					: t("items.none"),
		},
		{
			label: t("itemDetail.dailyUsage"),
			value: `${decimal.format(item.dailyUsage)} ${unitWord(item.dailyUsage, item.unit, t, locale)}`,
		},
	];

	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle>{t("itemDetail.stockLevel")}</CardTitle>
			</CardHeader>
			<CardContent className="grid @3xl/main:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">
				<div className="grid content-start gap-3">
					<p className="flex items-baseline gap-2">
						<span className="font-numeric font-semibold text-4xl tabular-nums">
							{number.format(item.onHand)}
						</span>
						<span className="text-muted-foreground text-sm">
							{unitWord(item.onHand, item.unit, t, locale)}
						</span>
					</p>
					<StockGauge
						onHand={item.onHand}
						minimum={item.minimum}
						reorderQuantity={item.reorderQuantity}
						status={item.status}
						size="md"
					/>
					<p className="text-muted-foreground text-sm">
						{item.daysOfCover === null
							? t("itemDetail.noUsage")
							: `${t("itemDetail.coverPrefix")} ${days.format(Math.floor(item.daysOfCover))}`}
					</p>
				</div>
				<dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
					{facts.map((fact) => (
						<div key={fact.label} className="grid gap-0.5">
							<dt className="text-muted-foreground">{fact.label}</dt>
							<dd className="font-medium tabular-nums">{fact.value}</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}
