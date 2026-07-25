import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/users")({
	component: UsersRoute,
});

function UsersRoute() {
	return <Outlet />;
}
