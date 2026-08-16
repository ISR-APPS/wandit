import { createFileRoute } from "@tanstack/react-router";

import { OverviewPage } from "@/features/overview/pages/overview-page";
import {
	adminDashboardSearchValidator,
	getAdminOverviewQuery,
	mergeAdminDashboardDateRangeQuery,
} from "@/lib/admin-date-range";

function DashboardRoute() {
	const search = Route.useSearch();
	const query = getAdminOverviewQuery(search);
	const navigate = Route.useNavigate();

	return (
		<OverviewPage
			query={query}
			onQueryChange={(nextQuery) => {
				void navigate({
					search: mergeAdminDashboardDateRangeQuery(search, nextQuery),
					replace: true,
				});
			}}
		/>
	);
}

export const Route = createFileRoute("/_dashboard/dashboard")({
	validateSearch: adminDashboardSearchValidator,
	component: DashboardRoute,
	head: () => ({
		meta: [
			{
				title: "Overview | Wandit Admin",
			},
		],
	}),
});
