import { createFileRoute } from "@tanstack/react-router";

import { StoryLinksPage } from "@/features/story-links/pages/story-links-page";
import { adminAnalyticsSearchValidator } from "@/lib/admin-date-range";

function StoryLinksRoute() {
	const query = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<StoryLinksPage
			query={query}
			onQueryChange={(nextQuery) => {
				void navigate({ search: nextQuery, replace: true });
			}}
		/>
	);
}

export const Route = createFileRoute("/_dashboard/links")({
	validateSearch: adminAnalyticsSearchValidator,
	component: StoryLinksRoute,
	head: () => ({
		meta: [{ title: "Links | Wandit Admin" }],
	}),
});
