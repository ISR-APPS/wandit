import { createFileRoute } from "@tanstack/react-router";

import { LoginPage } from "@/features/auth/pages/login-page";

type LoginSearch = {
	error?: "oauth" | "forbidden";
};

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>): LoginSearch => ({
		error:
			search.error === "oauth" || search.error === "forbidden"
				? search.error
				: undefined,
	}),
	component: LoginPage,
	head: () => ({
		meta: [
			{
				title: "Sign in | Wandit Admin",
			},
		],
	}),
});
