// The audience page behind login. The /app layout checks the session first.
// The loader fills the audience profile and the two growth reads of the first period. Thin: the page lives in the audience feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	AudiencePage,
	AudiencePageError,
	AudiencePageSkeleton,
	audienceQueryOptions,
	followerGainByChannelQueryOptions,
	followerGrowthQueryOptions,
} from "~/features/audience";
import { DEFAULT_DAYS } from "~/features/social";

/** /app/audience: who follows the brand, where, when, and how fast the audience grows. */
export const Route = createFileRoute("/app/audience")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(audienceQueryOptions()),
			context.queryClient.query(followerGrowthQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(
				followerGainByChannelQueryOptions(DEFAULT_DAYS),
			),
		]),
	pendingComponent: AudiencePageSkeleton,
	errorComponent: AudiencePageError,
	component: AudiencePage,
});
