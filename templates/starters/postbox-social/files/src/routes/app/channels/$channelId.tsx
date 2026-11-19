// The page of one channel. The /app layout checks the session first.
// The loader fills the channel profile. Thin: the page lives in the channels feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	ChannelDetailPage,
	ChannelDetailPageSkeleton,
	ChannelsPageError,
	channelDetailQueryOptions,
} from "~/features/channels";

/** /app/channels/$channelId. `params.channelId` is any text from the URL; the query returns null for an unknown id. */
export const Route = createFileRoute("/app/channels/$channelId")({
	loader: ({ context, params }) =>
		context.queryClient.query(channelDetailQueryOptions(params.channelId)),
	pendingComponent: ChannelDetailPageSkeleton,
	errorComponent: ChannelsPageError,
	component: ChannelDetailRoute,
});

function ChannelDetailRoute() {
	const { channelId } = Route.useParams();
	return <ChannelDetailPage channelId={channelId} />;
}
