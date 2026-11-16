// The Activity list behind login. The /app layout checks the session first.
// The loader fills the transaction cache. Thin: the page and its states live in the activity feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	ActivityPage,
	ActivityPageError,
	ActivityPageSkeleton,
	activitySearchSchema,
	transactionsQueryOptions,
} from "~/features/activity";

/** /app/activity: every transaction of the user, newest first. `?tx=` opens the side panel of one transaction. */
export const Route = createFileRoute("/app/activity")({
	validateSearch: activitySearchSchema,
	loader: ({ context }) =>
		context.queryClient.query(transactionsQueryOptions()),
	pendingComponent: ActivityPageSkeleton,
	errorComponent: ActivityPageError,
	component: ActivityPage,
});
