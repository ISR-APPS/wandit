// The dialog of one product: its price and stock facts, the units sold per day, and the newest orders with it.
// ProductsPage opens it from the product table and from the restock card.
// The sales record loads after the click, so the dialog has its own loading and error states.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import {
	dateTimeFormat,
	dayCountFormat,
	fillMessage,
	moneyFormat,
	OrderStatusBadge,
	ProductTile,
} from "~/features/shop";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/shared/ui/dialog";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	type Product,
	productSalesQueryOptions,
	SALES_DAYS,
} from "../api/products.queries";
import { StockLevelBadge } from "./stock-level-badge";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const ProductUnitsChart = lazy(() =>
	import("./product-units-chart").then((module) => ({
		default: module.ProductUnitsChart,
	})),
);

type ProductDialogProps = {
	/** The product to show. It stays set while the dialog closes, so the content does not empty during the fade. */
	product: Product | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** A controlled dialog. It renders no content before the first click on a product. */
export function ProductDialog({
	product,
	open,
	onOpenChange,
}: ProductDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
				{product ? <ProductPanel key={product.id} product={product} /> : null}
			</DialogContent>
		</Dialog>
	);
}

type ProductPanelProps = {
	/** The row of the product list. The panel adds the sales record of this product. */
	product: Product;
};

// The content of the dialog for one product.
function ProductPanel({ product }: ProductPanelProps) {
	const { t, locale } = useT();
	const sales = useQuery(productSalesQueryOptions(product.id));
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const dayCount = dayCountFormat(locale);
	const dateTime = dateTimeFormat(locale);
	const period = dayCount.format(SALES_DAYS);

	const facts = [
		{ label: t("products.price"), value: money.format(product.price) },
		{ label: t("products.stock"), value: number.format(product.stock) },
		{
			label: t("products.reorderPoint"),
			value: number.format(product.reorderPoint),
		},
		{
			label: fillMessage(t("products.soldIn"), { days: period }),
			value: number.format(product.soldUnits),
		},
		{
			label: t("products.cover"),
			value:
				product.coverDays === null
					? t("products.noSales")
					: dayCount.format(Math.round(product.coverDays)),
		},
		{
			label: t("products.soldSinceOpening"),
			// The sales record loads after the click. The error block below explains an empty value.
			value: sales.data ? (
				number.format(sales.data.lifetimeUnits)
			) : sales.isError ? (
				""
			) : (
				<Skeleton className="h-5 w-12" />
			),
		},
	];

	return (
		<>
			<DialogHeader>
				<div className="flex items-center gap-3 pe-8 text-start">
					<ProductTile category={product.category} className="size-12" />
					<div className="grid min-w-0 gap-1">
						<DialogTitle>{product.name}</DialogTitle>
						<DialogDescription>
							{`${product.sku} · ${t(`products.categories.${product.category}`)}`}
						</DialogDescription>
					</div>
				</div>
			</DialogHeader>
			<div>
				<StockLevelBadge level={product.stockLevel} />
			</div>
			<dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
				{facts.map((fact) => (
					<div key={fact.label} className="grid gap-0.5">
						<dt className="text-muted-foreground">{fact.label}</dt>
						<dd className="min-h-6 font-numeric font-semibold text-base">
							{fact.value}
						</dd>
					</div>
				))}
			</dl>
			{sales.isError ? (
				<div className="grid justify-items-start gap-3">
					<p className="text-sm" role="alert">
						{t("products.salesError")}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => sales.refetch()}
					>
						{t("common.retry")}
					</Button>
				</div>
			) : sales.data === undefined ? (
				<div className="grid gap-3">
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-32 w-full" />
				</div>
			) : (
				<>
					<div className="grid gap-2">
						<p className="font-medium text-sm">
							{fillMessage(t("products.unitsPerDay"), { days: period })}
						</p>
						{/* The chart script loads after the page. The placeholder has the height of the chart. */}
						<Suspense fallback={<Skeleton className="h-24 w-full" />}>
							<ProductUnitsChart
								points={sales.data.unitsPerDay}
								label={fillMessage(t("products.unitsChartLabel"), {
									count: number.format(product.soldUnits),
									days: period,
								})}
							/>
						</Suspense>
					</div>
					<div className="grid gap-1">
						<p className="font-medium text-sm">{t("products.latestOrders")}</p>
						{sales.data.recentOrders.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								{t("products.noOrders")}
							</p>
						) : (
							<ul className="grid divide-y">
								{sales.data.recentOrders.map((order) => (
									<li
										key={order.orderId}
										className="flex min-h-11 items-center justify-between gap-3 py-1.5 text-sm"
									>
										<div className="flex min-w-0 items-baseline gap-2">
											<Link
												to="/app/orders/$orderId"
												params={{ orderId: order.orderId }}
												className="relative font-medium tabular-nums hover:underline max-sm:before:absolute max-sm:before:-inset-3"
											>
												{`#${order.orderId}`}
											</Link>
											<span
												className="truncate text-muted-foreground"
												dir="auto"
											>
												{order.customerName}
											</span>
										</div>
										<div className="flex shrink-0 items-center gap-3">
											<span className="hidden text-muted-foreground text-xs tabular-nums sm:inline">
												{dateTime.format(new Date(order.placedAt))}
											</span>
											<span className="tabular-nums">
												{fillMessage(t("products.times"), {
													count: number.format(order.quantity),
												})}
											</span>
											<OrderStatusBadge status={order.status} />
										</div>
									</li>
								))}
							</ul>
						)}
					</div>
				</>
			)}
		</>
	);
}
