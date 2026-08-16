import { createFileRoute } from "@tanstack/react-router";

import { FunnelAnalyticsPage } from "@/features/analytics/pages/funnel-analytics-page";
import { adminStandardAnalyticsSearchValidator } from "@/lib/admin-date-range";

function AnalyticsFunnelRoute() {
	const query = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<FunnelAnalyticsPage
			query={query}
			onQueryChange={(nextQuery) => {
				const { cohortOnly: _cohortOnly, ...search } = nextQuery;
				void navigate({ search, replace: true });
			}}
		/>
	);
}

export const Route = createFileRoute("/_dashboard/analytics/funnel")({
	validateSearch: adminStandardAnalyticsSearchValidator,
	component: AnalyticsFunnelRoute,
	head: () => ({
		meta: [{ title: "Funnel Analytics | Wandit Admin" }],
	}),
});
