// The venues page behind login. The /app layout checks the session first.
// The loader fills the venue list and the KPI row. Thin: the page and its states live in the venues feature.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
	VenuesPage,
	VenuesPageError,
	VenuesPageSkeleton,
	venueKpisQueryOptions,
	venuesQueryOptions,
} from "~/features/venues";

// `venue` is a venue id from the URL, for example "v-lantern". An id that is no venue opens no panel.
const venuesSearchSchema = z.object({
	venue: z.string().max(40).optional().catch(undefined),
});

/** /app/venues. `?venue=v-lantern` opens the side panel of that venue. */
export const Route = createFileRoute("/app/venues")({
	validateSearch: venuesSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(venuesQueryOptions()),
			context.queryClient.query(venueKpisQueryOptions()),
		]),
	pendingComponent: VenuesPageSkeleton,
	errorComponent: VenuesPageError,
	component: VenuesRoute,
});

function VenuesRoute() {
	const { venue } = Route.useSearch();
	return <VenuesPage openVenueId={venue} />;
}
