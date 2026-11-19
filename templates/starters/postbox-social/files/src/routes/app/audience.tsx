// The audience page behind login. The /app layout checks the session first.
// The loader fills the audience profile, the growth of the first period, and the inbox thread.
// Thin: the page lives in the audience feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	AudiencePage,
	AudiencePageError,
	AudiencePageSkeleton,
	audienceGrowthQueryOptions,
	audienceQueryOptions,
	inboxQueryOptions,
} from "~/features/audience";
import { DEFAULT_DAYS } from "~/features/social";

/** /app/audience: where the followers are, how fast they grow, and one inbox thread. */
export const Route = createFileRoute("/app/audience")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(audienceQueryOptions()),
			context.queryClient.query(audienceGrowthQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(inboxQueryOptions()),
		]),
	pendingComponent: AudiencePageSkeleton,
	errorComponent: AudiencePageError,
	component: AudiencePage,
});
