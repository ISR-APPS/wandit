import { createFileRoute } from "@tanstack/react-router";

import { UserDetailPage } from "@/features/users/pages/user-detail-page";

export const Route = createFileRoute("/_dashboard/users/$userId/")({
	component: UserDetailRoute,
	head: () => ({
		meta: [{ title: "User details | Wandit Admin" }],
	}),
});

function UserDetailRoute() {
	const { userId } = Route.useParams();

	return <UserDetailPage userId={userId} />;
}
