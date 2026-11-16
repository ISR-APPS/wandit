// The detail page of one card. The /app layout checks the session first.
// The loader fills the card and its spend of the first period. Thin: the page lives in the cards feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	CARD_DEFAULT_DAYS,
	CardDetailPage,
	CardDetailPageSkeleton,
	CardsPageError,
	cardDetailQueryOptions,
	cardRunningSpendQueryOptions,
} from "~/features/cards";

/** /app/cards/$cardId. The id is any text from the URL; the query returns null for an unknown id. */
export const Route = createFileRoute("/app/cards/$cardId")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query(cardDetailQueryOptions(params.cardId)),
			context.queryClient.query(
				cardRunningSpendQueryOptions(params.cardId, CARD_DEFAULT_DAYS),
			),
		]),
	pendingComponent: CardDetailPageSkeleton,
	errorComponent: CardsPageError,
	component: CardDetailRoute,
});

function CardDetailRoute() {
	const { cardId } = Route.useParams();
	return <CardDetailPage cardId={cardId} />;
}
