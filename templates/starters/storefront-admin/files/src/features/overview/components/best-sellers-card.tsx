// The "Best sellers" table card of the home: every product that sold in the period, the most revenue first.
// OverviewPage renders it at the end of the last band, beside the recent orders. RecordTable pages the rows by 8.
// Export downloads the rows as CSV. The row menu opens the product dialog or copies the SKU.
import { ExportIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	copyToClipboard,
	downloadCsv,
	moneyFormat,
	ProductTile,
	toCsv,
} from "~/features/shop";
import { useT } from "~/shared/i18n";
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
import type { BestSeller } from "../lib/summary";

type BestSellersCardProps = {
	/** The products that sold in the period, the most revenue first. */
	products: BestSeller[];
	className?: string;
};

/** The revenue and the units are sortable, as in the kit. */
export function BestSellersCard({ products, className }: BestSellersCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);

	const columns: RecordColumn<BestSeller>[] = [
		{
			id: "product",
			header: t("products.product"),
			cell: (product) => (
				<div className="flex items-center gap-3">
					<ProductTile category={product.category} className="size-8" />
					{/* A long name wraps, so the row menu stays inside the card at a 1440 px page width. */}
					<span className="min-w-28 max-w-40 whitespace-normal">
						{product.name}
					</span>
				</div>
			),
		},
		{
			id: "revenue",
			header: t("overview.sellers.revenue"),
			sortValue: (product) => product.revenue,
			cell: (product) => (
				<span className="font-medium tabular-nums">
					{money.format(product.revenue)}
				</span>
			),
		},
		{
			id: "units",
			header: t("overview.sellers.units"),
			sortValue: (product) => product.units,
			cell: (product) => (
				<span className="tabular-nums">{number.format(product.units)}</span>
			),
		},
	];

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("overview.sellers.title")}</CardTitle>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						aria-label={t("common.export")}
						disabled={products.length === 0}
						onClick={() =>
							downloadCsv(
								"best-sellers.csv",
								toCsv(products, [
									{ header: t("products.product"), value: (row) => row.name },
									{ header: t("products.sku"), value: (row) => row.sku },
									{
										header: t("overview.sellers.revenue"),
										value: (row) => String(row.revenue),
									},
									{
										header: t("overview.sellers.units"),
										value: (row) => String(row.units),
									},
								]),
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
					rows={products}
					columns={columns}
					searchText={(product) => `${product.name} ${product.sku}`}
					searchPlaceholder={t("overview.sellers.filter")}
					pageSize={8}
					noResults={t("products.noResults")}
					rowMenu={(product) => (
						<>
							<DropdownMenuItem asChild>
								<Link to="/app/products" search={{ product: product.id }}>
									{t("products.open")}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() =>
									copyToClipboard(product.sku, {
										done: t("table.copied"),
										failed: t("table.copyFailed"),
									})
								}
							>
								{t("products.copySku")}
							</DropdownMenuItem>
						</>
					)}
				/>
			</CardContent>
		</Card>
	);
}
