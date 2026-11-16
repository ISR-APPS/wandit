// The page of one member. The /app layout checks the session first.
// The loader fills the member cache. Thin: the page lives in the members feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	MemberDetailPage,
	MemberDetailPageSkeleton,
	MembersPageError,
	memberQueryOptions,
} from "~/features/members";

/** /app/members/$memberId. `params.memberId` is any text from the URL; the query checks it. */
export const Route = createFileRoute("/app/members/$memberId")({
	loader: ({ context, params }) =>
		context.queryClient.query(memberQueryOptions(params.memberId)),
	pendingComponent: MemberDetailPageSkeleton,
	errorComponent: MembersPageError,
	component: MemberDetailRoute,
});

function MemberDetailRoute() {
	const { memberId } = Route.useParams();
	return <MemberDetailPage memberId={memberId} />;
}
