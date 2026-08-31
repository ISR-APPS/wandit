import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/offline-billing")({
	component: OfflineBillingRoute,
	head: () => ({
		meta: [{ title: "Offline billing | Wandit Admin" }],
	}),
});

function OfflineBillingRoute() {
	return <Outlet />;
}
