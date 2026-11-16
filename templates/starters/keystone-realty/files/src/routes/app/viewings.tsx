// The viewings page behind login. The /app layout checks the session first.
// The loader fills the viewings cache. Thin: the page and its states live in the viewings feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	ViewingsPage,
	ViewingsPageError,
	ViewingsPageSkeleton,
	viewingsQueryOptions,
} from "~/features/viewings";

/** /app/viewings: the agenda of the week, the viewings to confirm, and the past viewings. */
export const Route = createFileRoute("/app/viewings")({
	loader: ({ context }) => context.queryClient.query(viewingsQueryOptions()),
	pendingComponent: ViewingsPageSkeleton,
	errorComponent: ViewingsPageError,
	component: ViewingsPage,
});
