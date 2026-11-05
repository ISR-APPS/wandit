/**
 * Old `/workspace/members` URL. The People page replaced the members page,
 * so old links and bookmarks go to `/workspace/people`.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/workspace/members")({
	beforeLoad: () => {
		throw redirect({ to: "/workspace/people", replace: true });
	},
});
