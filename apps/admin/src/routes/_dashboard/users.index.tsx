import { createFileRoute } from "@tanstack/react-router";

import { UsersPage } from "@/features/users/pages/users-page";

export const Route = createFileRoute("/_dashboard/users/")({
	component: UsersPage,
	head: () => ({
		meta: [
			{
				title: "Users | Wandit Admin",
			},
		],
	}),
});
