import { createFileRoute } from "@tanstack/react-router";

import { AcquisitionAnalyticsPage } from "@/features/analytics/pages/acquisition-analytics-page";
import { adminStandardAnalyticsSearchValidator } from "@/lib/admin-date-range";

function AnalyticsAcquisitionRoute() {
	const query = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<AcquisitionAnalyticsPage
			query={query}
			onQueryChange={(nextQuery) => {
				const { cohortOnly: _cohortOnly, ...search } = nextQuery;
				void navigate({ search, replace: true });
			}}
		/>
	);
}

export const Route = createFileRoute("/_dashboard/analytics/acquisition")({
	validateSearch: adminStandardAnalyticsSearchValidator,
	component: AnalyticsAcquisitionRoute,
	head: () => ({
		meta: [{ title: "Acquisition Analytics | Wandit Admin" }],
	}),
});
