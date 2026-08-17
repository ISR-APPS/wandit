import { createFileRoute } from "@tanstack/react-router";

import TermsPage from "@/features/legal/pages/terms-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/terms")({
	head: () => ({
		meta: [
			{ title: pageTitle("legal.terms.meta.title") },
			{
				name: "description",
				content: pageTitle("legal.terms.meta.description"),
			},
		],
	}),
	component: TermsPage,
});
