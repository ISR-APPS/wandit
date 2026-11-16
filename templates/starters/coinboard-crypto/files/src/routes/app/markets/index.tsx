// The Markets list behind login. The /app layout checks the session first.
// The loader fills the asset cache. Thin: the page and its states live in the markets feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	assetsQueryOptions,
	MarketsPage,
	MarketsPageError,
	MarketsPageSkeleton,
	marketsSearchSchema,
} from "~/features/markets";

/** /app/markets: every asset of the market list. `?move=` opens the tab of one price direction. */
export const Route = createFileRoute("/app/markets/")({
	validateSearch: marketsSearchSchema,
	loader: ({ context }) => context.queryClient.query(assetsQueryOptions()),
	pendingComponent: MarketsPageSkeleton,
	errorComponent: MarketsPageError,
	component: MarketsPage,
});
