// The home of the app behind login: the portfolio mosaic. The /app layout checks the session first.
// The loader fills the caches of every tile in parallel. Thin: the page and its states live in the portfolio feature.
import { createFileRoute } from "@tanstack/react-router";
import { transactionsQueryOptions } from "~/features/activity";
import { positionsQueryOptions } from "~/features/holdings";
import { DEFAULT_DAYS } from "~/features/ledger";
import { assetsQueryOptions } from "~/features/markets";
import {
	PortfolioPage,
	PortfolioPageError,
	PortfolioPageSkeleton,
	portfolioSummaryQueryOptions,
	portfolioValuesQueryOptions,
} from "~/features/portfolio";

/** /app: the portfolio value, the allocation, the market mood, the trend, the top holdings, and the newest activity. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(portfolioSummaryQueryOptions()),
			context.queryClient.query(portfolioValuesQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(positionsQueryOptions()),
			context.queryClient.query(assetsQueryOptions()),
			context.queryClient.query(transactionsQueryOptions()),
		]),
	pendingComponent: PortfolioPageSkeleton,
	errorComponent: PortfolioPageError,
	component: PortfolioPage,
});
