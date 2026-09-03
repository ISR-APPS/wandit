import { createFileRoute } from "@tanstack/react-router";

import PricingPage from "@/features/landing/pages/pricing-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/pricing")({
	head: () => ({
		meta: [
			{ title: pageTitle("landing.pricing.meta.title") },
			{
				name: "description",
				content: pageTitle("landing.pricing.meta.description"),
			},
		],
	}),
	component: PricingPage,
});
