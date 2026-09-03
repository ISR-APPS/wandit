import { createFileRoute } from "@tanstack/react-router";

import { RevenueAnalyticsPage } from "@/features/analytics/pages/revenue-analytics-page";
import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { adminStandardAnalyticsSearchValidator } from "@/lib/admin-date-range";

function AnalyticsRevenueRoute() {
	const query = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<RequireAdminPermission permission={{ analytics: ["read"] }}>
			<RevenueAnalyticsPage
				query={query}
				onQueryChange={(nextQuery) => {
					const { cohortOnly: _cohortOnly, ...search } = nextQuery;
					void navigate({ search, replace: true });
				}}
			/>
		</RequireAdminPermission>
	);
}

export const Route = createFileRoute("/_dashboard/analytics/revenue")({
	validateSearch: adminStandardAnalyticsSearchValidator,
	component: AnalyticsRevenueRoute,
	head: () => ({
		meta: [{ title: "Revenue Analytics | Wandit Admin" }],
	}),
});
