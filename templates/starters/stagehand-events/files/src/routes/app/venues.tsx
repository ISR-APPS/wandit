// The venues page behind login. The /app layout checks the session first.
// The loader fills the venue list. Thin: the page and its states live in the venues feature.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
	VenuesPage,
	VenuesPageError,
	VenuesPageSkeleton,
	venuesQueryOptions,
} from "~/features/venues";

// `venue` is a venue id from the URL, for example "v-lantern". An id that is no venue opens no panel.
const venuesSearchSchema = z.object({
	venue: z.string().max(40).optional().catch(undefined),
});

/** /app/venues. `?venue=v-lantern` opens the side panel of that venue. */
export const Route = createFileRoute("/app/venues")({
	validateSearch: venuesSearchSchema,
	loader: ({ context }) => context.queryClient.query(venuesQueryOptions()),
	pendingComponent: VenuesPageSkeleton,
	errorComponent: VenuesPageError,
	component: VenuesRoute,
});

function VenuesRoute() {
	const { venue } = Route.useSearch();
	return <VenuesPage openVenueId={venue} />;
}
