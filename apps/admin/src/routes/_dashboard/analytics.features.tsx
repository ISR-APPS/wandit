import { createFileRoute } from "@tanstack/react-router";

import { FeaturesAnalyticsPage } from "@/features/analytics/pages/features-analytics-page";
import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { adminStandardAnalyticsSearchValidator } from "@/lib/admin-date-range";

function AnalyticsFeaturesRoute() {
	const query = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<RequireAdminPermission permission={{ analytics: ["read"] }}>
			<FeaturesAnalyticsPage
				query={query}
				onQueryChange={(nextQuery) => {
					const { cohortOnly: _cohortOnly, ...search } = nextQuery;
					void navigate({ search, replace: true });
				}}
			/>
		</RequireAdminPermission>
	);
}

export const Route = createFileRoute("/_dashboard/analytics/features")({
	validateSearch: adminStandardAnalyticsSearchValidator,
	component: AnalyticsFeaturesRoute,
	head: () => ({
		meta: [{ title: "Features & Credits | Wandit Admin" }],
	}),
});
