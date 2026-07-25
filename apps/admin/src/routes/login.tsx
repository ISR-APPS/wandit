import { createFileRoute } from "@tanstack/react-router";

import { LoginPage } from "@/features/auth/pages/login-page";

export const Route = createFileRoute("/login")({
	component: LoginPage,
	head: () => ({
		meta: [
			{
				title: "Sign in | Wandit Admin",
			},
		],
	}),
});
