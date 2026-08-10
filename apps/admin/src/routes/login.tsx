import { createFileRoute } from "@tanstack/react-router";

import {
	type LoginError,
	parseLoginError,
} from "@/features/auth/lib/auth-navigation";
import { LoginPage } from "@/features/auth/pages/login-page";

type LoginSearch = {
	error?: LoginError;
};

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>): LoginSearch => ({
		error: parseLoginError(search.error),
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
