// The post list behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the posts feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	PostsPage,
	PostsPageError,
	PostsPageSkeleton,
	postsQueryOptions,
} from "~/features/posts";

/** /app/posts: the posts of the last 90 days, the queue, and the drafts. */
export const Route = createFileRoute("/app/posts/")({
	loader: ({ context }) => context.queryClient.query(postsQueryOptions()),
	pendingComponent: PostsPageSkeleton,
	errorComponent: PostsPageError,
	component: PostsPage,
});
