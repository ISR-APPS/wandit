// Public landing route. Prerendered at build time.
// Thin: the page lives in the landing feature. The head holds the title, the description, and the icon of the club.
import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "~/features/landing";
import { defaultLocale, getDictionary, translate } from "~/shared/i18n";

export const Route = createFileRoute("/")({
	head: () => {
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
