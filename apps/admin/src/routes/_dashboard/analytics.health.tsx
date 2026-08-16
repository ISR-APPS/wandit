import { createFileRoute } from "@tanstack/react-router";

import { HealthAnalyticsPage } from "@/features/analytics/pages/health-analytics-page";
import { adminStandardAnalyticsSearchValidator } from "@/lib/admin-date-range";

function AnalyticsHealthRoute() {
	const query = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<HealthAnalyticsPage
			query={query}
			onQueryChange={(nextQuery) => {
				const { cohortOnly: _cohortOnly, ...search } = nextQuery;
				void navigate({ search, replace: true });
			}}
		/>
	);
}

export const Route = createFileRoute("/_dashboard/analytics/health")({
	validateSearch: adminStandardAnalyticsSearchValidator,
	component: AnalyticsHealthRoute,
	head: () => ({
		meta: [{ title: "System Health | Wandit Admin" }],
	}),
});
