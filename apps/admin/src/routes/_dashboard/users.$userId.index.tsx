import { createFileRoute } from "@tanstack/react-router";

import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { UserDetailPage } from "@/features/users/pages/user-detail-page";

export const Route = createFileRoute("/_dashboard/users/$userId/")({
	component: UserDetailRoute,
	head: () => ({
		meta: [{ title: "User details | Wandit Admin" }],
	}),
});

function UserDetailRoute() {
	const { userId } = Route.useParams();

	return (
		<RequireAdminPermission permission={{ users: ["read"] }}>
			<UserDetailPage userId={userId} />
		</RequireAdminPermission>
	);
}
