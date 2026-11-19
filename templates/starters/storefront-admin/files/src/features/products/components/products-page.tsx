// The product page behind login, in the anatomy of the kit product list: the title and the export,
// four figure cards of the last 30 days, then the table with a search, the Status, Category, and Price filters,
// a column menu, row checkboxes, and pages. The /app/products route renders it after its loader.
// A product name puts the product in the URL (?product=), and the dialog shows that product.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	ChangeBadge,
	type CsvColumn,
	copyToClipboard,
	dayCountFormat,
	downloadCsv,
	fillMessage,
	moneyFormat,
	type PeriodFigure,
	PRODUCT_CATEGORIES,
	ProductTile,
	STOCK_LEVELS,
	toCsv,
} from "~/features/shop";
import { type TranslationKey, useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
} from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	catalogFiguresQueryOptions,
	type Product,
	productsQueryOptions,
	SALES_DAYS,
} from "../api/products.queries";
import { ProductDialog } from "./product-dialog";
import { StockLevelBadge } from "./stock-level-badge";

const routeApi = getRouteApi("/app/products");

/**
 * The bands of the Price filter, in the app currency. `max` is exclusive; null has no top.
 * The sample catalog costs 8 to 96, so each band holds some products.
 */
const PRICE_BANDS = [
	{ id: "under20", min: 0, max: 20 },
	{ id: "20to40", min: 20, max: 40 },
	{ id: "40to60", min: 40, max: 60 },
	{ id: "over60", min: 60, max: null },
] as const;

type PriceBandId = (typeof PRICE_BANDS)[number]["id"];

/** The list page. The filters cut the rows; then RecordTable searches, sorts, and pages them. */
export function ProductsPage() {
	const { t, locale } = useT();
	const { data: products } = useSuspenseQuery(productsQueryOptions());
	const { data: figures } = useSuspenseQuery(catalogFiguresQueryOptions());
	const [level, setLevel] = useState<string | null>(null);
	const [category, setCategory] = useState<string | null>(null);
	const [priceBand, setPriceBand] = useState<PriceBandId | "all">("all");
	const { product: productId } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	// The id of the product that the dialog showed last. The dialog keeps this product while it fades out.
	const [closingId, setClosingId] = useState<string | null>(null);

	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const wholeMoney = moneyFormat(locale, "whole");
	const period = dayCountFormat(locale).format(SALES_DAYS);

	const openedProduct = products.find((row) => row.id === productId) ?? null;
	const dialogProduct =
		openedProduct ?? products.find((row) => row.id === closingId) ?? null;

	function openProduct(product: Product) {
		navigate({ search: { product: product.id }, replace: true });
	}

	const band = PRICE_BANDS.find((option) => option.id === priceBand);
	const rows = products.filter(
		(product) =>
			(level === null || product.stockLevel === level) &&
			(category === null || product.category === category) &&
			(band === undefined ||
				(product.price >= band.min &&
					(band.max === null || product.price < band.max))),
	);

	const csvColumns: CsvColumn<Product>[] = [
		{ header: t("products.product"), value: (row) => row.name },
		{ header: t("products.sku"), value: (row) => row.sku },
		{
			header: t("products.category"),
			value: (row) => t(`products.categories.${row.category}`),
		},
		{ header: t("products.price"), value: (row) => String(row.price) },
		{ header: t("products.stock"), value: (row) => String(row.stock) },
		{
			header: fillMessage(t("products.soldIn"), { days: period }),
			value: (row) => String(row.soldUnits),
		},
		{
			header: t("products.status"),
			value: (row) => t(`products.levels.${row.stockLevel}`),
		},
	];

	const columns: RecordColumn<Product>[] = [
		{
			id: "product",
			header: t("products.product"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="flex items-center gap-4">
					<ProductTile category={row.category} className="size-10" />
					<button
						type="button"
						className="max-w-56 truncate text-start font-medium hover:underline"
						onClick={() => openProduct(row)}
					>
						{row.name}
					</button>
				</div>
			),
		},
		{
			id: "price",
			header: t("products.price"),
			sortValue: (row) => row.price,
			cell: (row) => (
				<span className="tabular-nums">{money.format(row.price)}</span>
			),
		},
		{
			id: "category",
			header: t("products.category"),
			hideable: true,
			sortValue: (row) => PRODUCT_CATEGORIES.indexOf(row.category),
			cell: (row) => t(`products.categories.${row.category}`),
		},
		{
			id: "stock",
			header: t("products.stock"),
			hideable: true,
			sortValue: (row) => row.stock,
			cell: (row) => (
				<span className="tabular-nums">{number.format(row.stock)}</span>
			),
		},
		{
			id: "sku",
			header: t("products.sku"),
			hideable: true,
			cell: (row) => (
				<span className="text-muted-foreground tabular-nums">{row.sku}</span>
			),
		},
		{
			id: "sold",
			header: fillMessage(t("products.soldIn"), { days: period }),
			hideable: true,
			sortValue: (row) => row.soldUnits,
			cell: (row) => (
				<span className="tabular-nums">{number.format(row.soldUnits)}</span>
			),
		},
		{
			id: "status",
			header: t("products.status"),
			hideable: true,
			sortValue: (row) => STOCK_LEVELS.indexOf(row.stockLevel),
			cell: (row) => <StockLevelBadge level={row.stockLevel} />,
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("products.title")}
				actions={
					<Button
						type="button"
						disabled={rows.length === 0}
						onClick={() => downloadCsv("products.csv", toCsv(rows, csvColumns))}
					>
						<DownloadSimpleIcon />
						{t("common.exportCsv")}
					</Button>
				}
			/>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				<FigureCard
					labelKey="products.figures.revenue"
					value={wholeMoney.format(figures.revenue.value)}
					figure={figures.revenue}
					goodWhen="up"
				/>
				<FigureCard
					labelKey="products.figures.unitsSold"
					value={number.format(figures.unitsSold.value)}
					figure={figures.unitsSold}
					goodWhen="up"
				/>
				<FigureCard
					labelKey="products.figures.averagePrice"
					value={money.format(figures.averagePrice.value)}
					figure={figures.averagePrice}
					goodWhen="up"
				/>
				<FigureCard
					labelKey="products.figures.discounts"
					value={wholeMoney.format(figures.discounts.value)}
					figure={figures.discounts}
					goodWhen="down"
				/>
			</div>
			<div className="pt-4">
				{products.length === 0 ? (
					<p className="rounded-md border p-10 text-center text-muted-foreground text-sm">
						{t("products.empty")}
					</p>
				) : (
					<RecordTable
						rows={rows}
						columns={columns}
						searchText={(row) => `${row.name} ${row.sku}`}
						searchPlaceholder={t("products.search")}
						selectable
						pageSize={10}
						noResults={t("products.noResults")}
						toolbar={
							<>
								<RecordFilter
									label={t("products.status")}
									options={STOCK_LEVELS.map((value) => ({
										value,
										label: t(`products.levels.${value}`),
									}))}
									value={level}
									onValueChange={setLevel}
								/>
								<RecordFilter
									label={t("products.category")}
									options={PRODUCT_CATEGORIES.map((value) => ({
										value,
										label: t(`products.categories.${value}`),
									}))}
									value={category}
									onValueChange={setCategory}
								/>
								<Select
									value={priceBand}
									onValueChange={(value) =>
										setPriceBand(
											PRICE_BANDS.find((option) => option.id === value)?.id ??
												"all",
										)
									}
								>
									<SelectTrigger
										aria-label={t("products.price")}
										className="h-9 w-auto"
									>
										<span className="text-muted-foreground text-sm">
											{t("products.priceLabel")}
										</span>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">
											{t("products.allPrices")}
										</SelectItem>
										{PRICE_BANDS.map((option) => (
											<SelectItem key={option.id} value={option.id}>
												{t(`products.priceBands.${option.id}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</>
						}
						bulkActions={(selected) => (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-9"
								onClick={() =>
									downloadCsv(
										"products-selected.csv",
										toCsv(selected, csvColumns),
									)
								}
							>
								<DownloadSimpleIcon />
								{t("table.exportSelected")}
							</Button>
						)}
						rowMenu={(row) => (
							<>
								<DropdownMenuLabel>{t("table.actions")}</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem onSelect={() => openProduct(row)}>
									{t("products.open")}
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() =>
										copyToClipboard(row.sku, {
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
				)}
			</div>
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

type FigureCardProps = {
	/** The message key of the label, for example "products.figures.revenue". */
	labelKey: TranslationKey;
	/** The figure of the last SALES_DAYS days, already formatted. */
	value: string;
	/** The raw figure. The badge reads its change against the SALES_DAYS days before. */
	figure: PeriodFigure;
	goodWhen: "up" | "down";
};

// One figure card in the kit anatomy: the label, the large value, and the change badge at the end.
function FigureCard({ labelKey, value, figure, goodWhen }: FigureCardProps) {
	const { t } = useT();
	return (
		<Card>
			<CardHeader>
				<CardDescription>{t(labelKey)}</CardDescription>
				<CardTitle className="font-display @4xl/main:text-3xl text-2xl tabular-nums">
					{value}
				</CardTitle>
				<CardAction>
					<ChangeBadge
						change={figure.change}
						goodWhen={goodWhen}
						look="badge"
					/>
				</CardAction>
			</CardHeader>
		</Card>
	);
}

// Placeholder keys of the figure cards and the table rows. Fixed keys, because they never reorder.
const SKELETON_FIGURES = ["1", "2", "3", "4"];
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the product loader runs. The route sets it as pendingComponent. */
export function ProductsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-9 w-32" />
			</div>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_FIGURES.map((key) => (
					<Skeleton key={key} className="h-28" />
				))}
			</div>
			<div className="grid gap-2 pt-4">
				<Skeleton className="h-9 w-full sm:max-w-sm" />
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-14 w-full" />
				))}
			</div>
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
