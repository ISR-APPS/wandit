import { createFileRoute } from "@tanstack/react-router";

import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { UsersPage } from "@/features/users/pages/users-page";

export const Route = createFileRoute("/_dashboard/users/")({
	component: UsersIndexRoute,
	head: () => ({
		meta: [
			{
				title: "Users | Wandit Admin",
			},
		],
	}),
});

function UsersIndexRoute() {
	return (
		<RequireAdminPermission permission={{ users: ["read"] }}>
			<UsersPage />
		</RequireAdminPermission>
	);
}
