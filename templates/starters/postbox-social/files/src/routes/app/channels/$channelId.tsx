// The page of one channel. The /app layout checks the session first.
// The loader fills the channel facts and the figures of the first period. Thin: the page lives in the channels feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	ChannelDetailPage,
	ChannelDetailPageSkeleton,
	ChannelsPageError,
	channelPeriodQueryOptions,
	channelQueryOptions,
} from "~/features/channels";
import { DEFAULT_DAYS } from "~/features/social";

/** /app/channels/$channelId. `params.channelId` is any text from the URL; the query returns null for an unknown id. */
export const Route = createFileRoute("/app/channels/$channelId")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query(channelQueryOptions(params.channelId)),
			context.queryClient.query(
				channelPeriodQueryOptions(params.channelId, DEFAULT_DAYS),
			),
		]),
	pendingComponent: ChannelDetailPageSkeleton,
	errorComponent: ChannelsPageError,
	component: ChannelDetailRoute,
});

function ChannelDetailRoute() {
	const { channelId } = Route.useParams();
	return <ChannelDetailPage channelId={channelId} />;
}
