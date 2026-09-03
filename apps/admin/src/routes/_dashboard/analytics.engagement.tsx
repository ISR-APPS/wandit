import { createFileRoute } from "@tanstack/react-router";

import { EngagementAnalyticsPage } from "@/features/analytics/pages/engagement-analytics-page";
import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { adminAnalyticsSearchValidator } from "@/lib/admin-date-range";

function AnalyticsEngagementRoute() {
	const query = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<RequireAdminPermission permission={{ analytics: ["read"] }}>
			<EngagementAnalyticsPage
				query={query}
				onQueryChange={(nextQuery) => {
					void navigate({ search: nextQuery, replace: true });
				}}
			/>
		</RequireAdminPermission>
	);
}

export const Route = createFileRoute("/_dashboard/analytics/engagement")({
	validateSearch: adminAnalyticsSearchValidator,
	component: AnalyticsEngagementRoute,
	head: () => ({
		meta: [{ title: "Engagement Analytics | Wandit Admin" }],
	}),
});
