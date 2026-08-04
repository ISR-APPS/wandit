import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/organizations")({
	component: OrganizationsRoute,
});

function OrganizationsRoute() {
	return <Outlet />;
}
