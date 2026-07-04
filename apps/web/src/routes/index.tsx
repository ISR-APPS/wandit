import { createFileRoute } from "@tanstack/react-router";

import LandingPage from "@/features/landing/pages/landing-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/")({
	validateSearch: (search: Record<string, unknown>): { auth?: string } => ({
		auth: typeof search.auth === "string" ? search.auth : undefined,
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
