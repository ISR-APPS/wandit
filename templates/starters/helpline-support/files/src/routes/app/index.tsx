// The home behind login: the queue of the support desk. The /app layout checks the session first.
// The loader fills the ticket list, the Solved panel of DEFAULT_DAYS, and the topic breakdown.
// Thin: the page and its states live in the queue feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	DEFAULT_DAYS,
	deskFiguresQueryOptions,
	QueuePage,
	QueuePageError,
	QueuePageSkeleton,
	receivedByTopicQueryOptions,
	solvedPerDayQueryOptions,
} from "~/features/queue";
import { ticketsQueryOptions } from "~/features/tickets";

/** /app: Next up, the open queue, tickets solved per day, and tickets by topic. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(ticketsQueryOptions()),
			context.queryClient.query(solvedPerDayQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(deskFiguresQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(receivedByTopicQueryOptions(DEFAULT_DAYS)),
		]),
	pendingComponent: QueuePageSkeleton,
	errorComponent: QueuePageError,
	component: QueuePage,
});
