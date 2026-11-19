// The channel list behind login. The /app layout checks the session first.
// The loader fills the five channel rows. Thin: the page and its states live in the channels feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	ChannelsPage,
	ChannelsPageError,
	ChannelsPageSkeleton,
	channelsQueryOptions,
} from "~/features/channels";

/** /app/channels: one table row per account, with its followers and its 30-day figures. */
export const Route = createFileRoute("/app/channels/")({
	loader: ({ context }) => context.queryClient.query(channelsQueryOptions()),
	pendingComponent: ChannelsPageSkeleton,
	errorComponent: ChannelsPageError,
	component: ChannelsPage,
});
