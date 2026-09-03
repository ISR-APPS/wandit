import { createFileRoute } from "@tanstack/react-router";

import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { StoryLinksPage } from "@/features/story-links/pages/story-links-page";
import { adminAnalyticsSearchValidator } from "@/lib/admin-date-range";

function StoryLinksRoute() {
	const query = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<RequireAdminPermission permission={{ links: ["read"] }}>
			<StoryLinksPage
				query={query}
				onQueryChange={(nextQuery) => {
					void navigate({ search: nextQuery, replace: true });
				}}
			/>
		</RequireAdminPermission>
	);
}

export const Route = createFileRoute("/_dashboard/links")({
	validateSearch: adminAnalyticsSearchValidator,
	component: StoryLinksRoute,
	head: () => ({
		meta: [{ title: "Links | Wandit Admin" }],
	}),
});
