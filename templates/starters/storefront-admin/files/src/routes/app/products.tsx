// The product page behind login. The /app layout checks the session first.
// The loader fills the catalog cache. Thin: the page and its states live in the products feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	ProductsPage,
	ProductsPageError,
	ProductsPageSkeleton,
	productsQueryOptions,
	productsSearchSchema,
} from "~/features/products";

/** /app/products: the catalog with its stock and its sales of the last 30 days. `?product=` opens the dialog of one product. */
export const Route = createFileRoute("/app/products")({
	validateSearch: productsSearchSchema,
	loader: ({ context }) => context.queryClient.query(productsQueryOptions()),
	pendingComponent: ProductsPageSkeleton,
	errorComponent: ProductsPageError,
	component: ProductsPage,
});
