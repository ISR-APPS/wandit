import { createFileRoute } from "@tanstack/react-router";

import LandingPage from "@/features/landing/pages/landing-page";
import { sanitizeAuthRedirectPath } from "@/lib/auth-navigation";
import { pageTitle } from "@/lib/i18n";

type LandingSearch = {
	auth?: string;
	next?: string;
};

export const Route = createFileRoute("/")({
	validateSearch: (search: Record<string, unknown>): LandingSearch => ({
		auth: typeof search.auth === "string" ? search.auth : undefined,
		next:
			typeof search.next === "string"
				? sanitizeAuthRedirectPath(search.next)
				: undefined,
	}),
	head: () => ({
		meta: [
			{ title: pageTitle("landing.meta.title") },
			{
				name: "description",
				content: pageTitle("landing.meta.description"),
			},
		],
	}),
	component: LandingPage,
});
