// The cards of the business behind login. The /app layout checks the session first.
// The loader fills the card list and the KPI totals. Thin: the page lives in the cards feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	CardsPage,
	CardsPageError,
	CardsPageSkeleton,
	cardsQueryOptions,
	cardTotalsQueryOptions,
} from "~/features/cards";

/** /app/cards: the KPI row and the table of every card with its spend this month. */
export const Route = createFileRoute("/app/cards/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(cardsQueryOptions()),
			context.queryClient.query(cardTotalsQueryOptions()),
		]),
	pendingComponent: CardsPageSkeleton,
	errorComponent: CardsPageError,
	component: CardsPage,
});
