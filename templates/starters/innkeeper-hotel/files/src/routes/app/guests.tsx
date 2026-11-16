// The guests page behind login. The /app layout checks the session first.
// The loader fills the guest list. Thin: the page and its states live in the guests feature.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
	GuestsPage,
	GuestsPageError,
	GuestsPageSkeleton,
	guestsQueryOptions,
} from "~/features/guests";

// `guest` is a guest id from the URL, for example "guest-012". An id that is no guest opens no panel.
const guestsSearchSchema = z.object({
	guest: z.string().max(40).optional().catch(undefined),
});

/** /app/guests. `?guest=guest-012` opens the side panel of that guest. */
export const Route = createFileRoute("/app/guests")({
	validateSearch: guestsSearchSchema,
	loader: ({ context }) => context.queryClient.query(guestsQueryOptions()),
	pendingComponent: GuestsPageSkeleton,
	errorComponent: GuestsPageError,
	component: GuestsRoute,
});

function GuestsRoute() {
	const { guest } = Route.useSearch();
	return <GuestsPage openGuestId={guest} />;
}
