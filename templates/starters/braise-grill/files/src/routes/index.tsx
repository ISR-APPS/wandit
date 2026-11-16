// Public home route of the Braise grill house. Prerendered at build time.
// Thin: the page lives in the landing feature. The head gives the page its title, description, and icon.
import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "~/features/landing";
import { defaultLocale, getDictionary, translate } from "~/shared/i18n";

export const Route = createFileRoute("/")({
	head: () => {
		// A route head runs outside React, so it reads the default dictionary without useT().
		const dictionary = getDictionary(defaultLocale);
		return {
			meta: [
				{ title: translate(dictionary, "site.metaTitle") },
				{
					name: "description",
					content: translate(dictionary, "site.metaDescription"),
				},
			],
			links: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
		};
	},
	component: LandingPage,
});
