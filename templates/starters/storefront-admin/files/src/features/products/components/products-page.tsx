// The product page behind login: the units sold per category, the products to restock, and the catalog table.
// The /app/products route renders it after its loader. The route also uses the skeleton and the error below.
// A product name puts the product in the URL (?product=), and the dialog shows that product.
// The page holds the stock tab and the category filter.
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	dayCountFormat,
	fillMessage,
	moneyFormat,
	PRODUCT_CATEGORIES,
	type ProductCategory,
	ProductTile,
} from "~/features/shop";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	type Product,
	productsQueryOptions,
	SALES_DAYS,
} from "../api/products.queries";
import { STOCK_LEVELS, type StockLevel } from "../lib/stock";
import { CategoryBreakdownCard } from "./category-breakdown-card";
import { ProductDialog } from "./product-dialog";
import { RestockCard } from "./restock-card";
import { StockLevelBadge } from "./stock-level-badge";

const routeApi = getRouteApi("/app/products");

/** The product page. The two cards read the whole catalog; the tab and the category cut only the table. */
export function ProductsPage() {
	const { t, locale } = useT();
	const { data: products } = useSuspenseQuery(productsQueryOptions());
	const [level, setLevel] = useState<StockLevel | "all">("all");
	const [category, setCategory] = useState<ProductCategory | "all">("all");
	const { product: productId } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	// The id of the product that the dialog showed last. The dialog keeps this product while it fades out.
	const [closingId, setClosingId] = useState<string | null>(null);

	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const dayCount = dayCountFormat(locale);
	const period = dayCount.format(SALES_DAYS);

	const openedProduct = products.find((row) => row.id === productId) ?? null;
	const dialogProduct =
		openedProduct ?? products.find((row) => row.id === closingId) ?? null;

	function openProduct(product: Product) {
		navigate({ search: { product: product.id }, replace: true });
	}

	// The largest category comes first, so the legend reads as a ranking. The colors follow the category, not the place.
	const slices = PRODUCT_CATEGORIES.map((label) => ({
		label,
		value: products
			.filter((product) => product.category === label)
			.reduce((sum, product) => sum + product.soldUnits, 0),
	})).sort((first, second) => second.value - first.value);
	// An empty shelf comes first, then the shortest stock cover. A product with no sales has no end date.
	const toRestock = products
		.filter((product) => product.stockLevel !== "in_stock")
		.sort(
			(first, second) =>
				(first.stock === 0 ? -1 : (first.coverDays ?? Number.MAX_VALUE)) -
				(second.stock === 0 ? -1 : (second.coverDays ?? Number.MAX_VALUE)),
		);

	// The category filter comes first, so each tab count is the count of the rows that its tab shows.
	const byCategory =
		category === "all"
			? products
			: products.filter((product) => product.category === category);
	// A tab shows only for a level that has rows.
	const tabs = STOCK_LEVELS.map((value) => ({
		value,
		count: byCategory.filter((product) => product.stockLevel === value).length,
	})).filter((tab) => tab.count > 0);
	const activeLevel = tabs.some((tab) => tab.value === level) ? level : "all";
	const rows =
		activeLevel === "all"
			? byCategory
			: byCategory.filter((product) => product.stockLevel === activeLevel);

	const columns: DataTableColumn<Product>[] = [
		{
			id: "product",
			header: t("products.product"),
			sortValue: (row) => row.name,
			cell: (row) => (
				// On a phone the card edge falls on the end of the Stock column, so no badge is cut in the middle.
				// 16.125rem is the card padding and border, three cell paddings, and the next two cells (w-26, w-18).
				<div className="flex @md/main:w-auto w-[calc(100cqw-16.125rem)] items-center gap-3">
					<ProductTile
						category={row.category}
						className="@md/main:flex hidden"
					/>
					<div className="grid min-w-0 justify-items-start">
						<button
							type="button"
							className="relative whitespace-normal rounded-sm text-start font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 max-sm:before:absolute max-sm:before:-inset-3"
							onClick={() => openProduct(row)}
						>
							{row.name}
						</button>
						<span className="max-w-full truncate text-muted-foreground text-xs">
							{`${row.sku} · ${t(`products.categories.${row.category}`)}`}
						</span>
					</div>
				</div>
			),
		},
		{
			id: "level",
			header: t("products.availability"),
			sortValue: (row) => STOCK_LEVELS.indexOf(row.stockLevel),
			cell: (row) => (
				<div className="@md/main:w-auto w-26">
					<StockLevelBadge level={row.stockLevel} />
				</div>
			),
		},
		{
			id: "stock",
			header: t("products.stock"),
			align: "end",
			sortValue: (row) => row.stock,
			cell: (row) => (
				<div className="@md/main:w-auto w-18">{number.format(row.stock)}</div>
			),
		},
		{
			id: "sold",
			header: fillMessage(t("products.soldIn"), { days: period }),
			align: "end",
			sortValue: (row) => row.soldUnits,
			cell: (row) => number.format(row.soldUnits),
		},
		{
			id: "price",
			header: t("products.price"),
			align: "end",
			sortValue: (row) => row.price,
			cell: (row) => money.format(row.price),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("products.title")}
				description={t("products.description")}
			/>
			{products.length === 0 ? (
				<Card>
					<CardContent className="py-10 text-center text-muted-foreground text-sm">
						{t("products.empty")}
					</CardContent>
				</Card>
			) : (
				<>
					<div className="grid @4xl/main:grid-cols-3 grid-cols-1 gap-6">
						<CategoryBreakdownCard slices={slices} />
						<div className="@4xl/main:col-span-2 grid">
							<RestockCard products={toRestock} onOpen={openProduct} />
						</div>
					</div>
					<Card>
						{/* A narrower padding on a phone gives the table room for its first three columns. */}
						<CardContent className="@md/main:px-6 px-4">
							<DataTable
								rows={rows}
								columns={columns}
								searchText={(row) =>
									`${row.name} ${row.sku} ${t(`products.categories.${row.category}`)}`
								}
								noResults={t("products.noResults")}
								toolbar={
									<>
										<Tabs
											value={activeLevel}
											onValueChange={(value) =>
												setLevel(
													STOCK_LEVELS.find((option) => option === value) ??
														"all",
												)
											}
											// On a narrow card the tabs take their own line under the search and the filter.
											className="@4xl/main:order-none order-last max-w-full @4xl/main:basis-auto basis-full"
										>
											{/* On a narrow card the tabs wrap to a second line, so no tab label is cut. */}
											<TabsList className="flex-wrap group-data-[orientation=horizontal]/tabs:h-auto">
												<TabsTrigger value="all">
													{t("products.all")}
													<span className="text-muted-foreground tabular-nums">
														{number.format(byCategory.length)}
													</span>
												</TabsTrigger>
												{tabs.map((tab) => (
													<TabsTrigger key={tab.value} value={tab.value}>
														{t(`products.levels.${tab.value}`)}
														<span className="text-muted-foreground tabular-nums">
															{number.format(tab.count)}
														</span>
													</TabsTrigger>
												))}
											</TabsList>
										</Tabs>
										<Select
											value={category}
											onValueChange={(value) =>
												setCategory(
													PRODUCT_CATEGORIES.find(
														(option) => option === value,
													) ?? "all",
												)
											}
										>
											<SelectTrigger
												aria-label={t("products.category")}
												className="w-44 max-sm:w-full sm:ms-auto"
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent align="end">
												<SelectItem value="all">
													{t("products.allCategories")}
												</SelectItem>
												{PRODUCT_CATEGORIES.map((option) => (
													<SelectItem key={option} value={option}>
														{t(`products.categories.${option}`)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</>
								}
							/>
						</CardContent>
					</Card>
				</>
			)}
			<ProductDialog
				product={dialogProduct}
				open={openedProduct !== null}
				onOpenChange={(open) => {
					if (!open) {
						setClosingId(openedProduct?.id ?? null);
						navigate({ search: {}, replace: true });
					}
				}}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6"];

/** Placeholder while the product loader runs. The route sets it as pendingComponent. */
export function ProductsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-72" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 gap-6">
				<Skeleton className="h-96" />
				<Skeleton className="@4xl/main:col-span-2 h-96" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-xs" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the product page when the loader fails. Try again runs the loader again. */
export function ProductsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("products.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
