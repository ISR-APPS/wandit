import { createFileRoute } from "@tanstack/react-router";

import LandingPage from "@/features/landing/pages/landing-page";
import { sanitizeAuthRedirectPath } from "@/lib/auth-navigation";

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
			{ title: "Wandit — AI landing pages that sell" },
			{
				name: "description",
				content:
					"Wandit turns a prompt into a ready-to-run landing page — publish and collect COD orders in minutes.",
			},
		],
	}),
	component: LandingPage,
});
