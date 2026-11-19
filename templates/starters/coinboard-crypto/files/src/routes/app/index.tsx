// The home of the app behind login: the portfolio dashboard. The /app layout checks the session first.
// The loader fills the caches of every card in parallel. Thin: the page and its states live in the portfolio feature.
import { createFileRoute } from "@tanstack/react-router";
import { transactionsQueryOptions } from "~/features/activity";
import { positionsQueryOptions } from "~/features/holdings";
import { assetsQueryOptions } from "~/features/markets";
import {
	accountBalancesQueryOptions,
	PortfolioPage,
	PortfolioPageError,
	PortfolioPageSkeleton,
	portfolioSummaryQueryOptions,
} from "~/features/portfolio";

/** /app: the overview, the top holdings, the trade form, the recent activity, and the balance of each account. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(portfolioSummaryQueryOptions()),
			context.queryClient.query(accountBalancesQueryOptions()),
			context.queryClient.query(positionsQueryOptions()),
			context.queryClient.query(assetsQueryOptions()),
			context.queryClient.query(transactionsQueryOptions()),
		]),
	pendingComponent: PortfolioPageSkeleton,
	errorComponent: PortfolioPageError,
	component: PortfolioPage,
});
