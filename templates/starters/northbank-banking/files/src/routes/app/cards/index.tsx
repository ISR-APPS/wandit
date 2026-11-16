// The cards of the business behind login. The /app layout checks the session first.
// The loader fills the card list and the spend breakdown. Thin: the page lives in the cards feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	CardsPage,
	CardsPageError,
	CardsPageSkeleton,
	cardSpendBreakdownQueryOptions,
	cardsQueryOptions,
} from "~/features/cards";

/** /app/cards: every card with its spend this month. */
export const Route = createFileRoute("/app/cards/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(cardsQueryOptions()),
			context.queryClient.query(cardSpendBreakdownQueryOptions()),
		]),
	pendingComponent: CardsPageSkeleton,
	errorComponent: CardsPageError,
	component: CardsPage,
});
