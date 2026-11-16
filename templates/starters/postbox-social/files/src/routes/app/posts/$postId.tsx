// The page of one post. The /app layout checks the session first.
// The loader fills the post and its context. Thin: the page lives in the posts feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	PostDetailPage,
	PostDetailPageSkeleton,
	PostsPageError,
	postQueryOptions,
} from "~/features/posts";

/** /app/posts/$postId. `params.postId` is any text from the URL; the query returns null for an unknown id. */
export const Route = createFileRoute("/app/posts/$postId")({
	loader: ({ context, params }) =>
		context.queryClient.query(postQueryOptions(params.postId)),
	pendingComponent: PostDetailPageSkeleton,
	errorComponent: PostsPageError,
	component: PostDetailRoute,
});

function PostDetailRoute() {
	const { postId } = Route.useParams();
	return <PostDetailPage postId={postId} />;
}
