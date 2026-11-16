// The restock card of the product page: the products at or under their reorder point, the most urgent first.
// ProductsPage renders it with the low and out-of-stock rows of the product list. A name opens the product dialog.
import { dayCountFormat, fillMessage, ProductTile } from "~/features/shop";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { Product } from "../api/products.queries";
import { STOCK_LEVEL_BAR } from "../lib/stock";
import { StockLevelBadge } from "./stock-level-badge";

// 5 rows give the card the height of the breakdown card beside it.
const LIST_ROWS = 5;

type RestockCardProps = {
	/** The products with the level "low" or "out", the shortest stock cover first. */
	products: Product[];
	/** Opens the dialog of one product. */
	onOpen: (product: Product) => void;
};

/** The bar shows the stock against twice the reorder point: the half mark is the reorder point, an empty bar is an empty shelf. */
export function RestockCard({ products, onOpen }: RestockCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const dayCount = dayCountFormat(locale);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("products.restock")}</CardTitle>
				<CardDescription>
					{products.length === 0
						? t("products.restockNone")
						: fillMessage(
								t(
									products.length > LIST_ROWS
										? "products.restockFirst"
										: "products.restockAll",
								),
								{
									count: number.format(products.length),
									shown: number.format(LIST_ROWS),
								},
							)}
				</CardDescription>
			</CardHeader>
			{products.length === 0 ? null : (
				<CardContent>
					<ul className="grid divide-y border-t">
						{products.slice(0, LIST_ROWS).map((product) => (
							<li
								key={product.id}
								className="grid @2xl/main:grid-cols-[minmax(0,1fr)_9rem_7rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-2.5"
							>
								<div className="flex min-w-0 items-center gap-3">
									<ProductTile category={product.category} />
									<div className="grid min-w-0 justify-items-start">
										<button
											type="button"
											className="relative rounded-sm text-start font-medium text-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 max-sm:before:absolute max-sm:before:-inset-3"
											onClick={() => onOpen(product)}
										>
											{product.name}
										</button>
										<span className="text-muted-foreground text-xs">
											{product.coverDays === null || product.stock === 0
												? product.sku
												: fillMessage(t("products.coverLeft"), {
														days: dayCount.format(
															Math.max(1, Math.round(product.coverDays)),
														),
													})}
										</span>
									</div>
								</div>
								<div className="@2xl/main:grid hidden gap-1.5">
									<span className="text-muted-foreground text-xs tabular-nums">
										{fillMessage(t("products.stockOfReorder"), {
											stock: number.format(product.stock),
											reorder: number.format(product.reorderPoint),
										})}
									</span>
									{/* Twice the reorder point is the full bar, so a product at its reorder point shows half a bar. */}
									<Progress
										value={product.stock}
										max={product.reorderPoint * 2}
										className={STOCK_LEVEL_BAR[product.stockLevel]}
										aria-label={t("products.stockBar")}
									/>
								</div>
								<div className="flex justify-end">
									<StockLevelBadge level={product.stockLevel} />
								</div>
							</li>
						))}
					</ul>
				</CardContent>
			)}
		</Card>
	);
}
