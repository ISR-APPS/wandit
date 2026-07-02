import { createFileRoute } from "@tanstack/react-router";

import LandingPage from "@/features/landing/pages/landing-page";

export const Route = createFileRoute("/")({
	validateSearch: (search: Record<string, unknown>): { auth?: string } => ({
		auth: typeof search.auth === "string" ? search.auth : undefined,
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
