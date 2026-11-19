// The product mix card of the targets page: the bookings of the quarter per product line, as a donut with a legend.
// TargetsPage renders it first in the middle grid. The donut file loads with React.lazy.
// "Export" downloads the amount of every product line as CSV.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { lazy, Suspense } from "react";
import {
	CURRENCY,
	downloadCsv,
	moneyFormat,
	type ProductLine,
	toCsv,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { ProductSlice } from "./product-donut";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const ProductDonut = lazy(() =>
	import("./product-donut").then((module) => ({
		default: module.ProductDonut,
	})),
);

// The donut shows the 3 largest lines and one "Other" slice, so the legend fits one row of 4.
const SHOWN_LINES = 3;

type ProductMixCardProps = {
	/** Booked amount per product line of the quarter, largest first. */
	productMix: { productLine: ProductLine; amount: number }[];
};

/** The legend names each slice and its amount, so the color is never the only mark. */
export function ProductMixCard({ productMix }: ProductMixCardProps) {
	const { t, locale } = useT();
	const compactMoney = moneyFormat(locale, { compact: true });
	const total = productMix.reduce((sum, item) => sum + item.amount, 0);
	const otherAmount = productMix
		.slice(SHOWN_LINES)
		.reduce((sum, item) => sum + item.amount, 0);
	const slices: ProductSlice[] = [
		...productMix.slice(0, SHOWN_LINES).map((item, index) => ({
			key: item.productLine,
			label: t(`productLines.${item.productLine}`),
			value: item.amount,
			// The chart series 1 to 3 color the largest lines, series 4 colors "Other".
			color: `var(--chart-${index + 1})`,
		})),
		{
			key: "other",
			label: t("targets.mix.other"),
			value: otherAmount,
			color: `var(--chart-${SHOWN_LINES + 1})`,
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("targets.mix.title")}</CardTitle>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						onClick={() =>
							downloadCsv(
								"product-mix.csv",
								toCsv(
									productMix.map((item) => ({ id: item.productLine, ...item })),
									[
										{
											header: t("orders.product"),
											value: (row) => t(`productLines.${row.productLine}`),
										},
										{
											header: `${t("targets.booked")} (${CURRENCY})`,
											value: (row) => String(row.amount),
										},
									],
								),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("common.export")}
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-6">
				<Suspense
					fallback={<Skeleton className="mx-auto size-56 rounded-full" />}
				>
					<ProductDonut slices={slices} total={total} />
				</Suspense>
				<ul className="flex flex-wrap justify-around gap-x-4 gap-y-3">
					{slices.map((slice) => (
						<li key={slice.key} className="grid min-w-0 gap-1">
							<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
								<span
									aria-hidden="true"
									className="size-2 shrink-0 rounded-full"
									style={{ backgroundColor: slice.color }}
								/>
								<span className="truncate">{slice.label}</span>
							</span>
							<span className="ms-3.5 font-numeric font-semibold text-lg tabular-nums">
								{compactMoney.format(slice.value)}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
