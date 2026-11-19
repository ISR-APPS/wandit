// The product page behind login. The /app layout checks the session first.
// The loader fills the catalog and the figure caches. Thin: the page and its states live in the products feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	catalogFiguresQueryOptions,
	ProductsPage,
	ProductsPageError,
	ProductsPageSkeleton,
	productsQueryOptions,
	productsSearchSchema,
} from "~/features/products";

/** /app/products: the catalog with its stock and its sales of the last 30 days. `?product=` opens the dialog of one product. */
export const Route = createFileRoute("/app/products")({
	validateSearch: productsSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(productsQueryOptions()),
			context.queryClient.query(catalogFiguresQueryOptions()),
		]),
	pendingComponent: ProductsPageSkeleton,
	errorComponent: ProductsPageError,
	component: ProductsPage,
});
